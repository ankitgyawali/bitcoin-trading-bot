const parameters = require('./parameters.json').parameters;

/**
 * Price movement action analysis from elasticsearch dsl data.
 * @name btc_prices 
 * @module
 */ 

 /**
 * Return dsl for desired visualization.
 * @name btc_prices 
 * @function
 * @param {string} histogram_interval - Interval timeframes between each rows.
 * @param {string} agg_size - Number of rows to return per bucket for each timeframe.
 * @param {string} from - From time range for elasticsearch dsl, based on configured timeframe.
 * @param {string} to - To time range for elasticsearch dsl, based on configured timeframe.
 * @returns {object} DSL according to timeframe.
 */
module.exports = function (histogram_interval, agg_size, from, to) {
    // Defaults 
    from = from || parameters.defaults.from;
    to = to || parameters.defaults.to;
    histogram_interval = histogram_interval || parameters.defaults.interval;
    agg_size = agg_size || parameters.defaults.size;

    return {
    "size": 0,
    "_source": {
      "excludes": []
    },
    "aggs": {
      "TIMEFRAMES": {
        "date_histogram": {
          "field": "timestamp",
          "interval": histogram_interval,
          "time_zone": "America/New_York",
          "min_doc_count": 1
        },
        "aggs": {
          "LOWS": {
            "min": {
              "field": "ask"
            }
          },
          "HIGHS": {
            "max": {
              "field": "bid"
            }
          },
          "CLOSING": {
            "avg": {
              "field": "last_price"
            }
          }
        }
      }
    },
    "stored_fields": [
      "*"
    ],
    "script_fields": {},
    "docvalue_fields": [
      "timestamp"
    ],
    "query": {
      "bool": {
        "must": [
          {
            "match_all": {}
          },
          {
            "range": {
              "timestamp": {
                "gte": from,
                "lte": to
              }
            }
          }
        ],
        "filter": [],
        "should": [],
        "must_not": []
      }
    }
  }
}