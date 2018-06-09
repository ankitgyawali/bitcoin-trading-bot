'use strict'

const _ = require('lodash');

/**
 * Price movement action analysis from elasticsearch dsl data.
 * @name sentiment_momentum 
 * @module
 */ 
let process_signals = function(timeframe_results, timeframes, reference, hyperparameters){
    
    _.forEach(timeframe_results, function(result, index) { // For Each time frame

        let buys = []
        let sells = []  

        _.forEach(result.aggregations.SENTIMENT_MOMENTUM_TIMEFRAME.buckets, function(sub_bucket){

            let bucket_buy = (_.find(sub_bucket.SENTIMENT_TYPE.buckets, function(bucket) { return bucket.key=='positive' }));
            let bucket_sell = (_.find(sub_bucket.SENTIMENT_TYPE.buckets, function(bucket) { return bucket.key=='negative' }));
            if(bucket_buy){
                buys.push(bucket_buy.doc_count)
            }

            if(bucket_sell){
                sells.push(bucket_sell.doc_count)
            }

        });

        if(hyperparameters.timeframe_influence) {
            reference.sentiment_momentum.buy_strength += (buys[0] * (1/(index+1)))
            reference.sentiment_momentum.sell_strength += (sells[0] * (1/(index+1)))
        } else {
            reference.sentiment_momentum.buy_strength += buys[0]
            reference.sentiment_momentum.sell_strength += sells[0]
        }

        for(let i = 1; i<buys.length;i++) { // Trailing difference calculator
            if(hyperparameters.timeframe_influence) {
                reference.sentiment_momentum.buy_strength += (buys[i] * (1/(index+1)))
            } else {
                reference.sentiment_momentum.buy_strength += buys[i]                
            } // Influencing overall momentum counts by tinmeframe however seems unintuitive

            reference.sentiment_momentum.buy_strength_momentum += buys[i] - buys[i-1]
        }
     
        for(let j = 1; j<sells.length;j++) { // Trailing difference calculator to gather difference in momentum
            if(hyperparameters.timeframe_influence) {
                reference.sentiment_momentum.sell_strength += (sells[j] * (1/(index+1)))
            } else {
                reference.sentiment_momentum.sell_strength += sells[j]
            } // Influencing overall momentum counts by tinmeframe however seems unintuitive


            reference.sentiment_momentum.sell_strength_momentum += sells[j] - sells[j-1]
        }      
    }) // End processing one time frame

    return reference;
}

module.exports = { 
    process_signals:process_signals 
}