const urlModel = require("../model/urlModel");
const validUrl = require("valid-url");
const code = require("short-id");
const baseUrl = 'http://localhost:3000'
const redis = require("redis");
const { promisify } = require("util");


const isValid = function (value) {
    if (typeof (value) === undefined || typeof (value) === null) { return false }
    if (value.trim().length == 0) { return false }
    if (typeof (value) === "string" && value.trim().length > 0) { return true }
}

//Connect to redis
const redisClient = redis.createClient(
    13297,
    "redis-13297.c264.ap-south-1-1.ec2.cloud.redislabs.com",
    { no_ready_check: true }
);
redisClient.auth("Y2LKNj4Kg1MqicYoU0CzXP2lA5SjozlN", function (err) {
    if (err) throw err;
});

redisClient.on("connect", async function () {
    console.log("Connected to Redis..");
});

//Connection setup for redis

const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);


const shortenUrl = async function (req, res) {
    try {
        const data = req.body;

        if (Object.keys(data) == 0) { return res.status(400).send({ status: false, message: 'No data provided' }) }

        const longUri = req.body.longUrl;

        const longUrl = longUri.toLowerCase();

        if (!isValid(longUrl)) { return res.status(400).send({ status: false, message: 'Long Url is required' }) }

        if (!validUrl.isUri(longUrl)) { return res.status(400).send({ status: false, message: 'Please provide a valid URL' }) }

        if (!validUrl.isWebUri(longUrl)) { return res.status(400).send({ status: false, message: 'Please provide a valid URL' }) }

        if (!validUrl.isUri(baseUrl)) { return res.status(400).send({ status: false, message: 'The base URL is invalid' }) }

        let cachedData = await GET_ASYNC(`${longUrl}`)
        if (cachedData) { return res.status(200).send({ status: true, data: JSON.parse(cachedData) }) }

        const urlPresent = await urlModel.findOne({ longUrl: longUrl }).select({ _id: 0, timestamps: 0, __v: 0 })
        if (urlPresent) { return res.status(200).send({ status: true, data: urlPresent }) }

        const urlCode = code.generate()

        const shortUrl = baseUrl + '/' + urlCode;

        data.shortUrl = shortUrl;
        data.urlCode = urlCode;

        const newData = await urlModel.create(data);

        await SET_ASYNC(`${longUrl}`, JSON.stringify(data), "EX", 120);
        await SET_ASYNC(`${urlCode}`, JSON.stringify(data.longUrl), "EX", 120)

        return res.status(201).send({ status: true, data: data });


    }
    catch (error) {
        console.log(error)
        return res.status(500).send({ message: error.message })
    }
}




const redirect = async function (req, res) {
    try {
        const urlCode = req.params.urlCode;

        if (Object.keys(urlCode) == 0) { return res.status(400).send({ status: false, message: 'Please provide URL Code in Params' }) }

        let cachedData = await GET_ASYNC(`${urlCode}`)
        if (cachedData) { return res.status(302).redirect(JSON.parse(cachedData)) }

        const URL = await urlModel.findOne({ urlCode: urlCode })

        if (!URL) { return res.status(404).send({ status: false, message: 'No URL found with this URL Code. Please check input and try again' }) }

        await SET_ASYNC(`${urlCode}`, JSON.stringify(URL.longUrl), "EX", 120)

        return res.status(302).redirect(URL.longUrl);

    }

    catch (error) {
        console.log(error)
        return res.status(500).send({ message: error.message })
    }
}



module.exports.shortenUrl = shortenUrl;
module.exports.redirect = redirect;