'use strict'

/**
 * CRUD of hyperparameters.
 * TODO: This should be expanded when hyperparmeters are configured dynamically.
 * @name position_crud 
 * @module
 */ 

 /**
 * Return DSL to get most recent trade document.
 * @name position_crud 
 * @function
 * @returns {object} DSL to get most recent trade document.
 */
let get_recent = function(){
    // Document indexed last
    //  {
    //     "size": "1",
    //      "sort" : [
    //          { "@timestamp" : {"order" : "desc"}}]
    //  }
    // All open documents
     return {
        "size": 5000,
        "query": {
          "match": {
            "state.keyword": {
              "query": "open"
            }
          }
        }
      }    
}

module.exports = { get_recent: get_recent }