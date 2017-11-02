const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const reviewSchema = new Schema({
    'university_id' 
    'experience_rating',
    'area_of_study',
    'flagship_university_area_of_study',
    'workload',
    'languages',
    'university_fees',
    'side_jobs_opportunities',
    'party_opportunities',
    'side_jobs_rating',
    'integration_opportunities',
    'cultural_opportunities',
    'other_regions_visited',
    'description_city_life',
    'most_popular_activities',
    'three_words_experience',
    'cost_of_beer',
    'cost_of_frozen_pizza',
    'cost_of_coffee',
    'cost_of_rent'
    'platform', 
    'date_submit', 
    'referer',
    '_id'
    
}, {collection:"reviews"});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;