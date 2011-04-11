var ncms = require("../../lib/ncms"), sys = require('sys'), events = require('events');      

exports = module.exports = {init: init, route: route, jobs: {getFeed:getFeed}};

/**
 * Base feeds module
 * 
 * @param req      request object
 * @param menu     menu response object
 * @param blocks   blocks response object
 * @param db       database reference
 */
function route(req,res,module,app,next) {      

  next();
      
};

function init(module,app,next) {      
  
  next();
    
};

function getFeed(args) {
    
  try {
    args = JSON.parse(args);
  } catch(ex) {    
    console.log("Invalid arguments: " + args);
    return;  
  }
    
  var url = args.url;
  if(!url) {
     return;
  }
    
  // Allow this only to have local scope
  var feed = require('./lib/feed-expat');  
  
  var response = feed.parseURL(url, function(data) {        
          
      var feedType = data['#name'];
      
      switch (feedType) {
        case "feed":
          processAtom(data);
          break;
        case "rss":
          processRss(data);
          break;
        default:
           console.log("Unidentified feed type: " + feedType);
      }
      
  });
  
};

/**
 * AtomParser
 * @param data
 * @returns
 */
function AtomParser() {  
  
  var parser = this;  
  this.parse = function(data) {        
    if(data.entry) {
      data.entry.forEach(function(item) {
        parser.emit("item", item);    
      });
    }          
  }
  
};

function processAtom(data) {
  
  var parser = new AtomParser();
  parser.on('item', function(item) {
      processAtomItem(item);
  });
  parser.parse(data);
  
};

function processAtomItem(item) {
  
  var Content = ncms.lib.mongoose.model('Content');
  
  var alias = ncms.modules['content'].fn.titleAlias(item.title.text);
    
  Content.findOne({alias:alias},function (err, c) {
    
    if(!c) {
      var c = new Content();    
    }
    
    c.title=item.title.text;
    c.teaser=item.title.text;
    c.content=item.content.text;
    c.tags=[]; 
    c.status='published';
    c.alias = alias;                    
    c.author = "feeds";            
  
    // Asynch save
    c.save(function(err) {
      if(err) {
        console.log(err.message);
      }
    });
    
  });
  
};

/**
 * RSS Parser
 * @param data
 * @returns
 */
var RssParser = function(data) {
  
  var parser = this;  
  this.parse = function(data) {
        
    if(data.channel.item) {
      data.channel.item.forEach(function(item) {
        parser.emit("item", item);    
      });
    }          
  }
};

function processRss(data) {
  var parser = new RssParser();
  parser.on('item', function(item) {
      processRssItem(item);
  });
  parser.parse(data);
};


function processRssItem(item) {
    
  var Content = ncms.lib.mongoose.model('Content');  
  var alias = ncms.modules['content'].fn.titleAlias(item.title.text);
  
  
  Content.findOne({alias:alias},function (err, c) {
    
    if(!c) {
      var c = new Content();    
    }
    
    c.title=item.title.text;
    c.teaser=item.title.text;
    c.content=item.description.text;  
    c.status='published';
    
    // TODO: How do you cleanly update an array in Mongoosejs???
    if(c.tags) {
      var tags = c.tags;
      tags.forEach(function(v,k) {          
        c.tags.remove(v);
      });      
    } else {
      c.tags = [];  
    }    
    item.category.forEach(function(category) {
      c.tags.push(category.text);
    });
    
    c.alias = alias;                    
    c.author = "feeds";       
        
    // Asynch save
    c.save(function(err) {
      if(err) {
        console.log(err.message);
      }
    });
    
  });

 
};

sys.inherits(AtomParser, events.EventEmitter);
sys.inherits(RssParser, events.EventEmitter);