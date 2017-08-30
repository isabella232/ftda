const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const xml2js = Promise.promisifyAll(require('xml2js'));
const moment = require('moment');

function run(input){
  const parser = new xml2js.Parser();
  return fs.readFileAsync(input)
    .then(function(result){
      return parser.parseStringAsync(result);
    })
    .then(function(result){
      const issue = unwrap(unwrap(result.GALENP.Newspaper).issue);
      const published = moment(issue.pf, 'YYYYMMDD');

      const meta = {
        copyright: issue.copyright,
        published: published.toDate(),
        edition: issue.ed
      };

      const pages = [];

      for (let i = 0 ; i < issue.page.length ; i++){

        pages.push({
          id : issue.page[i].pageid[0]._,
          articles : issue.page[i].article
        });
      }

      return {
        meta: meta,
        pages : pages
      };
  });
}

function coordinates(text){
  if (!text){
    return;
  }
  return unwrap(text.pg).$.pos.split(',');
}

function unwrap(obj){
  if (Object.prototype.toString.call(obj) === '[object Array]' && obj.length === 1){
    return obj[0];
  }
  return false;
}

module.exports = {
  run: run,
  coordinates: coordinates,
  unwrap: unwrap
}
