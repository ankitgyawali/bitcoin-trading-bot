'use strict'

/**
 * Data model scaffolds for trade related information exchange.
 * @name trade_object_model 
 * @module
 */

/**
 * Returns model for elasticsearch positions document
 * @name final_eval 
 * @function
 */
let final_eval = function(){
    return {
    bot_signal: {  // Information about frequency of bot buys in order trade book 
        buy_strength:  0, // Bot buy frequency
        sell_strength: 0, // Bot sell frequency
        local_timeframe_buy_wins: 0  //  Positive tends towards more buys, local wins of frequency on each time influence (or not if configured) by timeframes 
    },
    sentiment_momentum: { // Information about consecutive rise in bitcoin prices, we want to trade this data on smaller timeframes if our parameters have been configured towards momentum trading
        buy_strength:  0, // Volume of buy
        sell_strength: 0, // Volume of sell
        buy_strength_momentum: 0, // Trailing difference on wins for calculation of variance in buys & wins to denote effectiveness of buy_strength wins
        sell_strength_momentum: 0  // Trailing difference on wins for calculation of variance in buys & wins to denote effectiveness of sell_strength wins
    },
    price_volume_analysis: { // Basic price volume analysis results
        isLocalVolBuyWin: 0, // Volume traded wins for buy in local time frames
        isLocalFrequencyBuyWin: 0, // Frequency traded wins in local time frames based on ticker data
        volume_difference: 0 // Total raw volume difference to indicate overall buys vs sells multiplied by price points
    },
    indicators: { // Standard indicators calculated using tulind indicators
        adsoc_indicator: 0, // Accumulation/Distruction Oscillation Indicator
        RSI: { // Standard RSI related metrics - capabilities for lookup of hidden divergences in prices & rsi haven't been implemented 
            average: 0, // Average rsi of a bucket since we are not calculating rsi during ingestion
            isStrongOverBoughtSignal: 0, // Configured rsi threshold since over bought and over sold conditions on medium timeframes for rsi are usually reliable signals
            isStrongOverSoldSignal: 0
        }
    },
    final_call: 0, // Final call enum, "bearish" || "bullish", ultimately you can only either take a position or not take one.
    confidence: 0, // +80 or -80 are usually labelled good confidence with default tunings - good enough to send email if you dont want automated bot signals
    position_sizes: undefined, // Configured position sizes
    trades: [], // Trade objects
    opened_at: undefined, // Trade Opened at date object
    closed_at: undefined, // Trade closed at date object
    metadata: {} // Extra data, holds traded timeframes and hyperparameters for back test analysis
    };
}; // Final JSON structure to hold results, ideally we would like to standardize this schema

/**
 * Returns model for trades array in position document
 * @name trade_data 
 * @function
 */
let trade_data = function(trade_size, fees_percent){
    return { 
    trade_size: trade_size, // Size of trade data, usually there are multiple sizes especially for gathering back testing data purposes
    trade_time: new Date(), // Time of trade object creation
    average_entry_price: 0, // Average entry price of trade against gdax order book
    entry_price: 0, // Total entry price of trade
    average_exit_price: 0, // Average Exit price of trade against gdax order book
    exit_price: 0, // Total exit price of trade
    realized_pnl: 0, // Percentage profit or loss between trade open and trade close duration
    realized_pnl_raw: 0, // Total raw dollaroos earned/lost
    fees_percent: fees_percent // Fees needed to offset raw pnl
    }
}

/**
 * Ratios used to create decision during final call evaluation
 * TODO: This data should be CRUD'able and programatically configurable via back testing for self learing purposes.
 * TODO: Same with hyperparmeters (not the timeframes though - since they are just buckets used for measurement)
 * @name assign_confidences 
 * @function
 */
let assign_confidences = function() {
    return { 
        bot_signal: 30,
    sentiment_momentum: 20,
    price_volume_analysis: 20,
    indicators: {
        adsoc: 20,
        RSI: 10
        }
    }
}

module.exports = {
    assign_confidences: assign_confidences,
    final_eval: final_eval,
    trade_data: trade_data
}
