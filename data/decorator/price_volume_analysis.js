'use strict'

const 
    _ = require('lodash'),
    tulind = require('tulind');

/**
 * Price volume analysis from two separate elasticsearch document.
 * @name process_signals 
 * @module
 */
let process_signals = function(prices, volumes, timeframes, reference, hyperparameters){

    prices = prices.map(obj => obj.aggregations.TIMEFRAMES.buckets)
    volumes = volumes.map(obj => obj.aggregations.TIMEFRAMES.buckets)

    let total_row_count = 0;

    _.forEach(prices, function(price, index){ // Each time frame
        let timeframe_prices = {  closing: [], lows: [], highs: [], volume: [] }
        let combined_analysis_rows = []

        _.forEach(price, function(price_row, inner_index){ // Each ROW
            let combined_analysis = {};
            
            timeframe_prices.closing.push(price_row.CLOSING.value)
            timeframe_prices.lows.push(price_row.LOWS.value)
            timeframe_prices.highs.push(price_row.HIGHS.value)
            

            let buy_vol_obj, sell_vol_obj;

            try {
                buy_vol_obj = _.find(volumes[index][inner_index].TYPE.buckets, function(bucket) { return bucket.key== 'buy' });
            } catch (e) {
                buy_vol_obj = false
            }
 
            try {
                sell_vol_obj = _.find(volumes[index][inner_index].TYPE.buckets, function(bucket) { return bucket.key== 'sell' });
            } catch (e) {
                sell_vol_obj = false
            }

            // Some time frames buckets will be small enough to not have any volume
            if(volumes[index][inner_index] && volumes[index][inner_index].TYPE && volumes[index][inner_index].TYPE.buckets && volumes[index][inner_index].TYPE.buckets.length){
                timeframe_prices.volume.push(volumes[index][inner_index].TYPE.buckets.reduce((a,b) => a.AMOUNT.value + b.AMOUNT.value))                
            } else {
                timeframe_prices.volume.push(0)
            }

            // Object containing combined data from price & volume dsl
            combined_analysis = { 
                highs:price_row.HIGHS.value , 
                lows:price_row.LOWS.value,
                closing:price_row.CLOSING.value, 
                volume: timeframe_prices.volume[timeframe_prices.volume.length -1],
                buy_volume: (buy_vol_obj)? buy_vol_obj.AMOUNT.value: 0,
                buy_frequency: (buy_vol_obj)? buy_vol_obj.doc_count: 0,
                sell_volume: (sell_vol_obj)? sell_vol_obj.AMOUNT.value: 0,
                sell_frequency: (sell_vol_obj)? sell_vol_obj.doc_count: 0,
                timeframe: new Date(price_row.key_as_string)
            };
            
            if(isNaN(combined_analysis.volume)) { combined_analysis.volume = 0; }

            combined_analysis.isLocalVolBuyWin = (combined_analysis.buy_volume > combined_analysis.sell_volume)? 1: -1;
            combined_analysis.isLocalFrequencyBuyWin = (combined_analysis.buy_frequency > combined_analysis.sell_frequency)? 1: -1;
            combined_analysis_rows.push(combined_analysis)

        }) // Begin processing between time frame loops now that we have data structure created
 
    // Volume analysis
    _.forEach(combined_analysis_rows, function(analysis){
        if (hyperparameters.timeframe_influence) { 
            reference.price_volume_analysis.isLocalVolBuyWin += (analysis.isLocalVolBuyWin * (1/(index+1)))
            reference.price_volume_analysis.isLocalFrequencyBuyWin += (analysis.isLocalFrequencyBuyWin * (1/(index+1)))
            reference.price_volume_analysis.volume_difference += ((analysis.buy_volume - analysis.sell_volume) * (1/(index+1)))
        } else {
            reference.price_volume_analysis.isLocalVolBuyWin += analysis.isLocalVolBuyWin
            reference.price_volume_analysis.isLocalFrequencyBuyWin += analysis.isLocalFrequencyBuyWin
            reference.price_volume_analysis.volume_difference += analysis.buy_volume - analysis.sell_volume
        }

    })


    // A. Accumulation Distribution Oscillator
    tulind.indicators.adosc.indicator([timeframe_prices.highs, timeframe_prices.lows, timeframe_prices.closing, timeframe_prices.volume], [3, 5], function(err, results) {
        if (hyperparameters.timeframe_influence) { 
            reference.indicators.adsoc_indicator += ((_.without(results[0], NaN).reduce(function(a, b) { return a + b; }, 0)) * (1/(index+1)))
        } else {
            reference.indicators.adsoc_indicator += (_.without(results[0], NaN).reduce(function(a, b) { return a + b; }, 0))
        }
      }); 

      // B. RSI
      tulind.indicators.rsi.indicator([timeframe_prices.closing], [5], function(err, results) {
        total_row_count++; // Tracking number of rsi we pushed to find average rsi

        // We can't influence rsi by timeframes -- since we are hard coding period for rsi calculation
        let current_rsi =  ((_.without(results[0], NaN).reduce(function(a, b) { return a + b; }, 0))/(_.without(results[0], NaN).length));
        reference.indicators.RSI.average += current_rsi


        // We can influence biasness of signal depending on the time frame however        
        if(current_rsi > 65) {
            if (hyperparameters.timeframe_influence) { 
                reference.indicators.RSI.isStrongOverBoughtSignal += (1 * (1/(index+1)))
            } else {
                reference.indicators.RSI.isStrongOverBoughtSignal += 1
            }

        }

        if(current_rsi < 35) {
            if (hyperparameters.timeframe_influence) { 
                reference.indicators.RSI.isStrongOverSoldSignal += (1 * (1/(index+1)))
            } else {
                reference.indicators.RSI.isStrongOverSoldSignal += 1
            }
        }
      });  

      // C. TODO: Stoic Oscillator
      
    }) // End one time frame

    reference.indicators.RSI.average =  reference.indicators.RSI.average/(total_row_count)
    return reference;
}

module.exports = { 
    process_signals:process_signals 
}