'use strict'


const bot_signals = require('./bot_signals'),
    btc_prices = require('./btc_prices'),
    sentiment_momentum = require('./sentiment_momentum'),
    volume_analysis = require('./volume_analysis'),
    utils = require('./utils'),
    positions_crud = require('./positions_crud'),
    params = require('./parameters.json');

module.exports = {
    bot_signals: bot_signals,
    btc_prices: btc_prices,
    volume_analysis: volume_analysis,
    sentiment_momentum: sentiment_momentum,
    positions_crud: positions_crud,
    utils: utils,
    params: params
}