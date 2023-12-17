const mongoose = require("mongoose");
const redis = require("redis");
const redisUrl = "redis://127.0.0.1:6379";
const client = redis.createClient(redisUrl);
const util = require("util");
client.hget = util.promisify(client.hget);

const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function (options = {}) {
  this.useCache = true;
  this.hashKey = JSON.stringify(options.key || "");
  return this;
};

mongoose.Query.prototype.exec = async function () {
  console.log("Im about to run a query");

  if (!this.useCache) {
    return exec.apply(this, arguments);
  }

  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name,
    })
  );
  console.log(key);

  // see if we have value for key in redis
  const cacheValue = await client.hget(this.hashKey, key);

  // if we do return that
  if (cacheValue) {
    const doc = JSON.parse(cacheValue);

    console.log("serving from cache");
    return Array.isArray(doc)
      ? doc.map((d) => new this.model(d))
      : new this.model(doc);
  }

  // otherwise isssue the query and store result in redis

  const result = await exec.apply(this, arguments);

  //   console.log(result);
  client.hset(this.hashKey, key, JSON.stringify(result));

  return result;
};
module.exports = {
  clearHash(hashKey) {
    client.del(JSON.stringify(hashKey));
  },
};
