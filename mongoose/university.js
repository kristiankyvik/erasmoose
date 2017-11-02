const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const universitySchema = new Schema({
    _id: String,
    name: String,
    votes: Number,
    url: String,
    country: String,
    createdAt: String,
    city: String,
    times_rank: Number,
    website: String,
    size: String,
    academics: String,
    sport: String,
    social: String,
    party: String
}, {collection:"universities"});

const University = mongoose.model('University', universitySchema);

module.exports = University;
