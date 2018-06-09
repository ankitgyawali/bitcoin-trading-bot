'use strict'

const _ = require('lodash'),
      config = require('./config.json'),
      ws = require('ws'),
      elasticsearch = require('elasticsearch'),
      w = new ws('wss://api.bitfinex.com/ws/2');

let context_timer_in_secs = config.env[config.environment].reset_num

let insert_on_ticker = config.env[config.environment].insert_on_ticker;


let connection_string  = {
  host: config.env[config.environment].elasticsearch
}

var client = new elasticsearch.Client(connection_string);


// Create a new context (a burst of data to be stored in es in one filesync call)
let context = resetcontext({})


// Listen to socket channels and normalize data
w.on('message', (msg) => normalize(JSON.parse(msg)))
w.on('open', () => w.send(JSON.stringify({ event: 'subscribe', channel: 'trades', symbol: 'tBTCUSD' })))
w.on('open', () => w.send(JSON.stringify({event: 'subscribe', channel: 'ticker', symbol: 'tBTCUSD' })))

// We use these schemas to ensure data matches to es
let ticker_schema = [
      'bid',
      'bid_size',
      'ask',
      'ask_size',
      'daily_change',
      'daily_change_perc',
      'last_price',
      'volume',
      'high',
      'low'
    ];

let trade_schema = [
        'ID',
        'MTS',
        'AMOUNT',
        'PRICE'
];

// Normalize data to es friendly format depending on data type
function normalize(msg) {
  if(_.isArray(msg)){
    if(msg.length == 2 && msg[1].length == ticker_schema.length) { // Logic for ticker data
      msg = {
        index: 'ticker',
        data: _.zipObject(ticker_schema, msg[1])
      }
      msg.data.timestamp = new Date()
      msg.type = (msg.data['last_price']  >  ((msg.data['bid']+msg.data['ask'])/2)) ? 'negative' : 'positive'
      msg.data.type = msg.type
      msg.data.avg = (msg.data.bid + msg.data.ask)/2
      msg.id = msg.data.timestamp.getTime()
    } else { // Logic for trade data
      if(msg[1] == 'te' && msg[2].length == trade_schema.length){
        msg = {
          index: 'trade',
          data: _.zipObject(trade_schema, msg[2])
        }
        msg.data.timestamp = new Date()
        // msg.data.timestamp = new Date(msg.data['MTS'])
        msg.type = (msg.data['AMOUNT'] > 0) ? "buy" : "sell"
        msg.id = msg.data['ID']
      }
    }
    if(msg.data) { // Insert data chunk into es and create a new context every configured seconds
      if (msg.index == 'ticker' &&   ((msg.data.timestamp.getTime() > context.end) || insert_on_ticker)) {
        // if (msg.index == 'ticker' &&   ((msg.data.timestamp.getTime() > context.end))) {
          insert_to_es(context, function(err, done){
            context = resetcontext(context)
            update_context(msg, context)        
        })
      } else {
        update_context(msg, context)
      }
    }

  }
}

// Update current context with provided data
function update_context(msg, context) {
  if(msg.index == 'trade') {
    context[msg.type]['amount']  = context[msg.type]['amount'] + msg.data['AMOUNT']
    context[msg.type]['frequency']  = context[msg.type]['frequency'] + 1
    context[msg.type]['price']  = (context[msg.type]['price'] + msg.data['PRICE'])
  } else {
    context.data.push({ "create" : { "_index" : 'btc-bfx-' + msg.index + '-' + new Date(context.end).toISOString().substring(0, 10) , "_type" : 'ticker', "_id" : msg.id } })
    context.data.push(msg.data)
    console.log(context.counter + ") Ticker price inserted: " + msg.data.ask)
    context.counter = context.counter + 1
  }
}


// Provide fresh data model for provided context
function resetcontext(context) {
  context = { 
    end: new Date().getTime() + context_timer_in_secs * 1000,
    data: [],
    counter: 1,
    buy: { timestamp: new Date(),  type: 'buy', amount: 0, price: 0, frequency: 0 },
    sell: { timestamp: new Date(),  type: 'sell', amount: 0, price: 0, frequency: 0 }
  }
  return context
}


function insert_to_es(context, callback) {
  // Insert into es here
  context.sell.amount = context.sell.amount * -1
  context.sell.price = context.sell.price/context.sell.frequency
  context.buy.price = context.buy.price/context.buy.frequency

  if(!isNaN(context.buy.price)){
    context.data.push({ "create" : { "_index" : 'btc-bfx-trade' + '-' + new Date(context.buy.timestamp).toISOString().substring(0, 10) , "_type" : 'trade', "_id" : context.buy.timestamp.getTime()+ 2000 } })
    context.data.push(context.buy)
    console.log(context.counter + ") Buy Trade Price: " + context.buy.price + ", Buy Trade Amount: " + context.buy.amount + ", Buy ID: " + new Date(context.buy.timestamp).toISOString())
    context.counter = context.counter + 1
  }

  if(!isNaN(context.sell.price)){
    context.data.push({ "create" : { "_index" : 'btc-bfx-trade' + '-' + new Date(context.sell.timestamp).toISOString().substring(0, 10) , "_type" : 'trade', "_id" : context.sell.timestamp.getTime() } })
    context.data.push(context.sell)
    console.log(context.counter + ") Sell Trade Price: " + context.sell.price + ", Sell Trade Amount: " + context.sell.amount + ", Sell ID: " + new Date(context.sell.timestamp).toISOString())
    context.counter = context.counter + 1 
  }

  console.log( "Inserting total of " + context.data.length/2 + " data for this context of " + context_timer_in_secs + " secs at: " + new Date(context.end).toISOString())
  console.log("\n\n -------------------------------------------------------------------------------------------------- \n\n")

  client.bulk({body: context.data},callback);

}


