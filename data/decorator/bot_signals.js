'use strict'

const _ = require('lodash');

/**
 * Process data from bot signals visualization to update final reference object.
 * @name bot_signals 
 * @module
 */
let process_signals = function(timeframe_results, timeframes, reference, hyperparameters){
    _.forEach(timeframe_results, function(result, index){ // For Each time frame

        _.forEach(result.aggregations.BOT_SIGNALS_TIMEFRAME.buckets, function(sub_bucket){
            let bucket_buy = (_.find(sub_bucket.BOT_SIGNALS_INTERVAL.buckets, function(bucket) { return bucket.key=='buy' }));
            let bucket_sell = (_.find(sub_bucket.BOT_SIGNALS_INTERVAL.buckets, function(bucket) { return bucket.key=='sell' }));

            // Index/2 -- higher the time frame less it matters
            if(bucket_buy && bucket_sell) {
                if(bucket_buy.doc_count > bucket_sell.doc_count){
                    if(hyperparameters.timeframe_influence){
                        reference.bot_signal.local_timeframe_buy_wins = reference.bot_signal.local_timeframe_buy_wins + (1/(index+1))                    
                    } else {
                        reference.bot_signal.local_timeframe_buy_wins = reference.bot_signal.local_timeframe_buy_wins + 1                        
                    }
                } else {
                    if(hyperparameters.timeframe_influence){
                    reference.bot_signal.local_timeframe_buy_wins = reference.bot_signal.local_timeframe_buy_wins - (1/(index+1))
                    } else{
                        reference.bot_signal.local_timeframe_buy_wins = reference.bot_signal.local_timeframe_buy_wins - 1                        
                    }
                }
            }
            
            if(bucket_buy) {
                if(hyperparameters.timeframe_influence){
                    reference.bot_signal.buy_strength += (bucket_buy.doc_count * (1/(index+1)))
                } else {
                    reference.bot_signal.buy_strength += (bucket_buy.doc_count)
                }
            }

            if(bucket_sell) {
                if(hyperparameters.timeframe_influence){
                    reference.bot_signal.sell_strength += (bucket_sell.doc_count * (1/(index+1)))
                } else {
                    reference.bot_signal.sell_strength += (bucket_sell.doc_count)   
                }
            }

          });
    })
    return reference;
}

module.exports = { 
    process_signals:process_signals 
}