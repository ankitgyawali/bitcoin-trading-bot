'use strict'

/**
 * Process aggregated data from elasticsearch.
 * @name decorator 
 * @module
 */

const bot_signals = require('./bot_signals'),
    price_volume_analysis = require('./price_volume_analysis'),
    trade_object_model = require('../trade_object_model'),
    sentiment_momentum = require('./sentiment_momentum');


/**
 * This where configured confidences are applied to trade against
 * @name FINAL_PROCESSOR 
 * @function
 * @param {object} final_reference - Final reference object to create confidence from.
 * @param {object} hyperparameters - Hyperparemeters configuration to use to make for call.
 * @returns {function} final_reference - Updated elasticsearch reference document object.
 */
let FINAL_PROCESSOR = function(final_reference, hyperparameters) {


    // Prioritize momentum indicators if hyperparmeters have set to trade in less than 120 min range
    // Also prioritize momentum indicator since we dont have longer time frame signal!
    if(hyperparameters.trade_intensity.match(/\d/g).join("") < 120) {
        if(!hyperparameters.wyckoff_phase.ranging) { // Tunings for ranging related calculation should be off

            let favor_trade_type = hyperparameters.trade_type; // We only look to open positions for over sold conditions if our bot is trading bearish with base pair 

            // Make sure stars are aligned before opening position
            // This could be dynamic with back testing data, hooked up with elasticsearch watcher's chain input
            // Confidence should always total to 100 at best case scenarios (hah!)
            let assign_confidences = trade_object_model.assign_confidences();

            // Bot Difference
            let bot_difference = final_reference.bot_signal.buy_strength - final_reference.bot_signal.sell_strength;
            if (bot_difference < 40 && bot_difference > -40) {
                    final_reference.confidence += assign_confidences.bot_signal * 0.5 * 0.75 * (bot_difference/Math.abs(bot_difference))// Half of total val times less tune for smaller vals
                } else {
                    final_reference.confidence += assign_confidences.bot_signal * 0.5 * 1 * (bot_difference/Math.abs(bot_difference))// Half                    
                }

                
            if(final_reference.bot_signal.local_timeframe_buy_wins < 1 && final_reference.bot_signal.local_timeframe_buy_wins  > 1) {
                final_reference.confidence += assign_confidences.bot_signal * 0.5 * 0.75  * (final_reference.bot_signal.local_timeframe_buy_wins/Math.abs(final_reference.bot_signal.local_timeframe_buy_wins))// Half of total val times less tune for smaller vals
            } else  {
                final_reference.confidence += assign_confidences.bot_signal * 0.5 * 1  * (final_reference.bot_signal.local_timeframe_buy_wins/Math.abs(final_reference.bot_signal.local_timeframe_buy_wins)) // Half of total val times less tune for smaller vals
            }

            let sentiment_strength = final_reference.sentiment_momentum.buy_strength - final_reference.sentiment_momentum.sell_strength;
            let sentiment_momentum = final_reference.sentiment_momentum.buy_strength_momentum - final_reference.sentiment_momentum.sell_strength_momentum;
            
            if (sentiment_strength > -30 && sentiment_strength < 30) {
                final_reference.confidence += assign_confidences.sentiment_momentum * 0.5 * 0.75 * (sentiment_strength/Math.abs(sentiment_strength)) // Half of total val times less tune for smaller vals
            } else {
                final_reference.confidence += assign_confidences.sentiment_momentum * 0.5 * 1 *  (sentiment_strength/Math.abs(sentiment_strength))// Half                    
            }

            if (sentiment_momentum > -30 && sentiment_momentum < 30) {
                final_reference.confidence += assign_confidences.sentiment_momentum * 0.5 * 0.75 *  (sentiment_momentum/Math.abs(sentiment_momentum)) // Half of total val times less tune for smaller vals
            } else {
                final_reference.confidence += assign_confidences.sentiment_momentum * 0.5 * 1 *  (sentiment_momentum/Math.abs(sentiment_momentum)) // Half                    
            }

            // Price volume indicators
            final_reference.confidence +=  assign_confidences.price_volume_analysis * 0.25 * (final_reference.price_volume_analysis.isLocalVolBuyWin/Math.abs(final_reference.price_volume_analysis.isLocalVolBuyWin)) 
            final_reference.confidence +=  assign_confidences.price_volume_analysis * 0.25 * (final_reference.price_volume_analysis.isLocalFrequencyBuyWin/Math.abs(final_reference.price_volume_analysis.isLocalFrequencyBuyWin)) 
            final_reference.confidence +=  assign_confidences.price_volume_analysis * 0.5 * (final_reference.price_volume_analysis.volume_difference/Math.abs(final_reference.price_volume_analysis.volume_difference)) 

            if(final_reference.indicators.adsoc_indicator > -200 &&  final_reference.indicators.adsoc_indicator < 200){
                final_reference.confidence +=  assign_confidences.indicators.adsoc * 0.8 * (final_reference.indicators.adsoc_indicator/Math.abs(final_reference.indicators.adsoc_indicator))
            
            } else {
                final_reference.confidence +=  assign_confidences.indicators.adsoc * 1 * (final_reference.indicators.adsoc_indicator/Math.abs(final_reference.indicators.adsoc_indicator))                 
            }


            // RSO omdocatprs
            if(final_reference.indicators.RSI.isStrongOverBoughtSignal !== 0 || final_reference.indicators.RSI.isStrongOverSoldSignal !== 0 ) {
                
                // We subtract over bought from over sold
                let difference_rsi = final_reference.indicators.RSI.isStrongOverSoldSignal - final_reference.indicators.RSI.isStrongOverBoughtSignal;
                // Positive means stronger over sold signal so buy
                final_reference.confidence +=  assign_confidences.indicators.RSI * 0.8 * (difference_rsi/Math.abs(difference_rsi))  

                if(final_reference.indicators.RSI < 40) {
                    final_reference.confidence -=  assign_confidences.indicators.RSI * 0.2   

                }

                if(final_reference.indicators.RSI < 50) {
                    final_reference.confidence +=  assign_confidences.indicators.RSI * 0.2   
                    
                }

                // TODO: Calculate divergences indicators on shorter time frames

            } else {
                // Not assigning confidence for rsi between 40 to 50
                if(final_reference.indicators.RSI < 40) {
                    final_reference.confidence -=  assign_confidences.indicators.RSI * 1   
                }

                if(final_reference.indicators.RSI < 50) {
                    final_reference.confidence +=  assign_confidences.indicators.RSI * 1   
                }

            }

            // Price volume indicators
           final_reference.final_call = (final_reference.confidence >0)? "bullish": "bearish";

        }
    }
    final_reference.confidence_absolute = Math.abs(final_reference.confidence)
    return final_reference
}

module.exports = {
    bot_signals: bot_signals,
    price_volume_analysis: price_volume_analysis,
    sentiment_momentum: sentiment_momentum,
    FINAL_PROCESSOR: FINAL_PROCESSOR
}