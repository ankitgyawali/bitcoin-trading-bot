const parameters = require('./parameters.json').parameters;

/**
 * Aggregated data for volume related documents..
 * @name volume_analysis 
 * @module
 */ 

 /**
 * Return dsl for desired visualization.
 * @name volume_analysis 
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
            "TYPE": {
              "terms": {
                "field": "type.keyword",
                "size": agg_size,
                "order": {
                  "AMOUNT": "desc"
                }
              },
              "aggs": {
                "AMOUNT": {
                  "sum": {
                    "field": "amount"
                  }
                }
              }
            }
          }
        }
      },
      "version": true,
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