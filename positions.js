'use strict'

/**
 * Get higher order data from elasticsearch and take position if confidence threshold is reached to make trades.
 * @name positions 
 * @module
 */

const _ = require('lodash'),
    config = require('./config.json'),
    uuid = require('uuid/v1'),
    ws = require('ws'),
    Bluebird = require("bluebird"),
    elasticsearch = require('elasticsearch'),
    Gdax = require('gdax'),
    sendmail = require('sendmail')(),
    publicClient = new Gdax.PublicClient(),
    dsl = require('./data/dsl'),
    model = require('./data/trade_object_model'),
    decorator = require('./data/decorator');


let connection_string = {
    host: config.env[config.environment].elasticsearch,
    defer: function() {
        return Bluebird.defer()
    }
}

console.log("Starting positions analyzer..")

var client = new elasticsearch.Client(connection_string);


var final_eval = model.final_eval();

/* 
 * Section 1: Standaradize according to config and initialize local vars 
 */
if (dsl.params.hyperparameters.wyckoff_phase.distribution == true) {
    dsl.params.parameters.timeframes.splice(-1, 1)
}

// Splice available timeframes to configured max timeframe
dsl.params.parameters.timeframes.length = _.findIndex(dsl.params.parameters.timeframes, function(o) {
    return o.from == dsl.params.hyperparameters.max_timeframe;
}) + 1


if (config.environment == 'dev' || config.environment == 'imp') {
    dsl.params.parameters.timeframes.length = 3;
}

// Define timeframe length to create decisions
final_eval.metadata.timeframes = dsl.params.parameters.timeframes;
final_eval.metadata.timeframe_length = dsl.params.parameters.timeframes.length;

let bot_signal_promises = [];
let sentiment_momentum_promises = [];
let ticker_promises = [];
let btc_volume_promises = [];



/* 
 * Section 2: Build array of promises to each dsl models for all available time frames
 */

_.forEach(dsl.params.parameters.timeframes, function(timeframe) {
    bot_signal_promises.push(client.search({
        index: 'btc-bfx-trade* ',
        body: dsl.bot_signals(timeframe.interval, timeframe.size, timeframe.from, timeframe.to)
    }))

    sentiment_momentum_promises.push(client.search({
        index: 'btc-bfx-ticker* ',
        body: dsl.sentiment_momentum(timeframe.interval, timeframe.size, timeframe.from, timeframe.to)
    }))

    btc_volume_promises.push(client.search({
        index: 'btc-bfx-trade* ',
        body: dsl.volume_analysis(timeframe.interval, timeframe.size, timeframe.from, timeframe.to)
    }))

    ticker_promises.push(client.search({
        index: 'btc-bfx-ticker* ', // Query Ticker Index
        body: dsl.btc_prices(timeframe.interval, timeframe.size, timeframe.from, timeframe.to)
    }))

});


var volume_result_placeholder = {};
console.log("Making calls to elasticsearch to fetch backdata..")


/* 
 * Section 3: Start processing promise results in chain using processors from data.decorator
 */
Promise.all(bot_signal_promises).then(bot_signal_results => {
    final_eval = decorator.bot_signals.process_signals(bot_signal_results, dsl.params.parameters.timeframes, final_eval, dsl.params.hyperparameters)
    return Promise.all(sentiment_momentum_promises)
}).then(sentiment_results => {
    final_eval = decorator.sentiment_momentum.process_signals(sentiment_results, dsl.params.parameters.timeframes, final_eval, dsl.params.hyperparameters)
    return Promise.all(btc_volume_promises)
}).then(volume_results => {
    volume_result_placeholder = volume_results;
    return Promise.all(ticker_promises)
}).then(ticker_results => {
    final_eval = decorator.price_volume_analysis.process_signals(ticker_results, volume_result_placeholder, dsl.params.parameters.timeframes, final_eval, dsl.params.hyperparameters)
    
    
    /* 
    * Section 4: Create a final call from final evaluation model (data/trade_object_model) and close previous position (if open) before taking a new position and alerting via email (if configured thresholds are reached).
    */
    final_eval = decorator.FINAL_PROCESSOR(final_eval, dsl.params.hyperparameters)
    close_old_position().then(old_position_data => {
        if (old_position_data && _.has(old_position_data, 'hits') && old_position_data.hits.total) { // If old position needs closing close
            // old_position_data = old_position_data.hits.hits[0]
            close_old_position_execute(old_position_data.hits.hits, function() {
                console.log("Opening a new position after closing old one..")
                make_position(final_eval, dsl.params, function(cb_data) {
                    final_eval = cb_data
                    let bulk = [];

                    _.forEach(final_eval.trades, function(trade){
                        bulk.push({
                            "create": {
                                "_index": 'btc-bfx-positions' + '-' + final_eval.opened_at.toISOString().substring(0, 10),
                                "_type": 'position',
                                "_id": uuid()
                            }
                        })
                        let flat_trade = _.clone(final_eval, true);
                        flat_trade.trades = trade
                         bulk.push(flat_trade)
                    })


                    client.bulk({ body: bulk }).then(done => {
                        // Send email if configured here
                        console.log("Created a new position.")
                        // let isConfidentToMail = true || final_eval.confidence  < dsl.params.alert.confidence_threshold[0] || final_eval.confidence > dsl.params.alert.confidence_threshold[1];
                        let isConfidentToMail = final_eval.confidence < dsl.params.alert.confidence_threshold[0] || final_eval.confidence > dsl.params.alert.confidence_threshold[1];
                        if (dsl.params.alert.isAlert && dsl.params.alert.config_property && isConfidentToMail) {
                            send_mail(JSON.stringify(final_eval, 1, 1), dsl.params.alert.email, function() {
                                console.log("Finished current positions flow.") // Process exits here
                            })
                        } else {
                            console.log("Finished current positions flow.") // Process exits here
                        }

                    }).catch(err => console.log(err));

                });

            })
        } else {
            console.log("No Position to close... opening a new position..")
            make_position(final_eval, dsl.params, function(cb_data) {
                final_eval = cb_data
                let bulk = [];

                _.forEach(final_eval.trades, function(trade){
                    bulk.push({
                        "create": {
                            "_index": 'btc-bfx-positions' + '-' + final_eval.opened_at.toISOString().substring(0, 10),
                            "_type": 'position',
                            "_id": uuid()
                        }
                    })
                    let flat_trade = _.clone(final_eval, true);
                    flat_trade.trades = trade
                     bulk.push(flat_trade)
                })

                client.bulk({
                    body: bulk
                }).then(done => {
                    console.log("Finished current positions flow.") // Process exits here
                }).catch(err => console.log(err));
            });
        }

    }).catch(err => console.log(err));
}).catch(err => console.log(err))


/**
 * Send email for more confident alerts.
 * @name send_mail 
 * @function
 * @param {object} string - Alert message to send.
 * @param {object} to - Email to send to.
 * @returns {function} Callback to perform once configured email has been sent
 */
let send_mail = function(string, to, cb) {
    sendmail({
        from: 'tradingbot@ankitgyawali.com',
        to: to,
        subject: 'BTC Signal',
        html: string,
    }, cb);
}

/**
 * DSL to get most recent open trade so it can be closed.
 * @name close_old_position 
 * @function
 * @returns {object} Elasticsearch DSL for most recent document on btc-bfx-positions* index.
 * 
 */
let close_old_position = function() {
    return client.search({
        index: 'btc-bfx-positions*',
        body: dsl.positions_crud.get_recent()
    })
}

/**
 * Actually execute open position from elasticsearch result. Gets latest gdax order book to traverse and close orders againt.
 * @name close_old_position 
 * @function
 * @param {object} old_trade_document - Elasticsearch document to close.
 * @returns {function} Callback
 */
let close_old_position_execute = function(old_trade_documents, cb) {
    publicClient.getProductOrderBook({
        productID: "BTC-USD",
        level: 2
    }, function(err, response, orderbook_data) {
        let bulk = []
        _.forEach(old_trade_documents, function(old_trade_document){

            old_trade_document._source.state = "closed"
            old_trade_document._source.trades = (traverse_asks_orderbook(orderbook_data.asks, old_trade_document._source.trades))

            bulk.push({
                update: {
                    _index: old_trade_document._index,
                    _type: old_trade_document._type,
                    _id: old_trade_document._id
                }
            })
            bulk.push({
                doc: old_trade_document._source
            })
        });

        client.bulk({
            body: bulk
        }).then(done => {
            cb()
        }).catch(err => console.log(err));
    });
    return;
}


/**
 * Traverse through gdax order book to sell an asset and calculate realized pnl against market price.
 * @name traverse_asks_orderbook 
 * @function
 * @param {object} order_book - Gdax orderbook array.
 * @param {object} trade_reference - Elasticsearch document to inspect.
 * @returns {object} Updated trade reference elasticsearch document.
 */
let traverse_asks_orderbook = function(order_book, trade_reference) {
    let amt_filled = 0;
    let index_cursor = -1;
    let exit_average_price = 0;

    for (let i = 0; i < order_book.length; i++) {
        amt_filled += parseFloat(order_book[i][1])
        exit_average_price += parseFloat(order_book[i][0])
        if (amt_filled >= trade_reference.trade_size) {
            index_cursor = i;
            break;
        }
    }

    if (index_cursor == -1) {
        trade_reference.close_metadata = "malformed"
    } else {
        trade_reference.close_metadata = "valid"
    }

    trade_reference.trade_close_time = new Date()
    trade_reference.average_exit_price = exit_average_price / (index_cursor + 1)
    trade_reference.exit_price = trade_reference.average_exit_price * trade_reference.trade_size
    trade_reference.realized_pnl_raw = trade_reference.exit_price - trade_reference.entry_price
    trade_reference.realized_pnl = ((trade_reference.exit_price - trade_reference.entry_price) / trade_reference.exit_price) * 100
    return trade_reference
};


/**
 * Traverse through gdax order book to buy an asset and return a new trade object (data/trade_object_models.js).
 * @name traverse_bids_orderbook 
 * @function
 * @param {object} order_book - Gdax orderbook array.
 * @param {object} trade_size - Amount of bitcoin to buy.
 * @param {object} fees_percent - Fees percent to initialize with.
 * @returns {object} New Trade object
 */
let traverse_bids_orderbook = function(order_book, trade_size, fees_percent) {

    let trade_data = model.trade_data(trade_size, fees_percent);

    let amt_filled = 0;
    let index_cursor = -1;

    for (let i = 0; i < order_book.length; i++) {
        amt_filled += parseFloat(order_book[i][1])
        trade_data.average_entry_price += parseFloat(order_book[i][0])
        if (amt_filled >= trade_size) {
            index_cursor = i;
            break;
        }
    }

    if (index_cursor == -1) {
        trade_data.open_metadata = "malformed"
    } else {
        trade_data.open_metadata = "valid"
    }
    trade_data.average_entry_price = trade_data.average_entry_price / (index_cursor + 1)
    trade_data.entry_price = trade_data.average_entry_price * trade_size
    trade_data.entry_fee = trade_data.entry_price * fees_percent
    return trade_data;
};


/**
 * Traverse through gdax order book to buy an asset and return a new trade object (data/trade_object_models.js).
 * @name make_position 
 * @function
 * @param {object} data - Results of chain processing of higher order data from elasticsearch.
 * @param {object} params - Configured parameters to decorate elasticsearch document with metadata before inserting.
 * @returns {cb} Callback with result of make position
 */
let make_position = async function(data, params, cb) {
    let trade_category;

    let isConfident = (data.confidence < params.hyperparameters.confidence_threshold[0] || data.confidence > params.hyperparameters.confidence_threshold[1])
    if (config.environment == 'dev' || config.environment == 'imp' || isConfident) {
        trade_category = (isConfident) ? "confident" : "demo";
        data.metadata.trade_environment = config.environment;
        data.metadata.trade_category = trade_category;
        data.position_sizes = params.position.available_trade_sizes
        // GDAX OrderBooks
        publicClient.getProductOrderBook({ productID: "BTC-USD", level: 2}, function(err, response, orderbook_data) {
            const total_fees_percent = params.position.fees.taker_fee + params.position.fees.error_margin
            _.forEach(params.position.available_trade_sizes, function(trade_size) {
                data.trades.push(traverse_bids_orderbook(orderbook_data.bids, trade_size, total_fees_percent))
            });

            data.opened_at = new Date()
            data['@timestamp'] = data.opened_at
            data.state = "open"
            cb(data)
        });
    }
};