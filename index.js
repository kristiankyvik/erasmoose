require('dotenv').config()
require('request'); // needed to force webpack to load request lib

const rp = require('request-promise');
const { parse } = require('url')
const { microGraphql, microGraphiql } = require('graphql-server-micro')
const { makeExecutableSchema } = require('graphql-tools')
const cors = require('micro-cors')();
const { MongoClient, ObjectId } = require('mongodb');

const prepare = (o) => {
  o._id = o._id["$oid"];
  return o;
};

const typeDefs = `
type University {   
  _id: String
  name: String
  votes: Int
  url: String
  country: String
  createdAt: String
  website: String
  city_name: String
  city_id: String
  uni_rating: AverageProperty
  int_orientation: AverageProperty
  workload: AverageProperty
  fees: AverageProperty
  opportunities: AverageProperty
  openness: AverageProperty
  clubs: AverageProperty
  party: AverageProperty
  female_percentage: AverageProperty
  reviews_count: Int
  main_disciplines: [Property]
  languages: [Property]
  difficulty: AverageProperty
  weekly_hours: AverageProperty
  overall_rating: Float
}
type Property {
  name: String
  count: Int
}
type AverageProperty {
  value: Float
  count: Int
}
type Meta {   
  count: Int
}

type City {
  _id: String
  name: String
  country: String
  votes: Int
  vibes: [Property]
  activities: [String]
  travel_options: AverageProperty
  rent_cost: AverageProperty
  beer_cost: AverageProperty
  coffee_cost: AverageProperty
  kebab_cost: AverageProperty
  monthly_cost: AverageProperty
  culture: AverageProperty
  if_you_like: [String]
  reviews_count: Int
  danceclub_cost: AverageProperty
  city_rating: AverageProperty
  student_friendliness: AverageProperty
  leisure: String
  nightlife: AverageProperty
  gastronomy: AverageProperty
  sports: AverageProperty
}
type ReviewsMeta { 
  unisCount: Int,
  reviewsCount: Int
}

type Review {
  uni_review: String
  city_review: String
  date_submit: String
  _id: String
}

type Query {
  allUnis(first: Int, skip: Int, searchKey: String): [University]
  getCity(_id: String): City
  _allUnisMeta: Meta
  _allReviewsMeta: ReviewsMeta
  getReviews(city_id: String, university_id: String): [Review]
}

type Success {
  ok: Boolean
}

type Mutation {
  updateUniversity(_id: String, votes: Int): University
  sendFeedback(email: String, messages: String): Success
}

# we need to tell the server which types represent the root query
# and root mutation types. We call them RootQuery and RootMutation by convention.
schema {
  query: Query
  mutation: Mutation
}
`;

let resolvers;
let schema;
let hasSetup = false;

const setup = async () => {

  const db = await MongoClient.connect(process.env.MLAB_URL);

  resolvers = {
    Query: {
      allUnis: async (_, opts) => {
        // DO NOT REMOVE CONSOLE.LOG
        // EVER -> ALRIGHT BRO CHILL -> KINDA FREAKED ME OUT THIS MESSAGE
        console.log(opts);
        return await db.collection("universities").find(
          {
            $or: [ 
              {
                country: {
                  '$regex': opts.searchKey,
                  '$options': 'i'
                }
              },
              {
                name: {
                  '$regex': opts.searchKey,
                  '$options': 'i'
                }
              }, 
              {
                city_name: {
                  '$regex': opts.searchKey,
                  '$options': 'i'
                }
              }   
            ]
          },
          {
            sort: { overall_rating: -1 },
            limit: opts.first,
            skip: opts.skip,
          }
        ).toArray();
      },
      getCity: async (_, opts) => {
        return await db.collection("cities").findOne({_id: opts._id ? new ObjectId(opts._id) : null })
      },
      _allUnisMeta: async () => {
        const count = await db.collection("universities").count(); 
        return { count };
      },
      getReviews: async (_, opts) => {
        const attrib = Object.keys(opts)[0] == 'city_id' ? 'city_review' : 'uni_review';
        opts[attrib] = {$exists: true};
        opts["$where"] = `this.${attrib}.length > 40`; 
        return await db.collection("reviews").find(opts, {limit: 3}).toArray();
      },
      _allReviewsMeta: async () => {
        const metaCursor =  await db.collection('universities').aggregate([
          { 
            $match: { 
              'uni_rating.count': { $gt: 0 } 
            } 
          },
          { 
            $group: { 
              _id: '', 
              reviewsCount: { 
                $sum: "$uni_rating.count"
              }, 
              unisCount: { 
                $sum: 1 
              } 
            } 
          }
        ]).toArray();

        return metaCursor[0];
      }
    },
    Mutation: {
      updateUniversity: async (whot, opts) => {
        return await db.collection("universities").update({
          _id: opts._id
        },
          {
            "$set": { votes: opts.votes }
          });
      },
      sendFeedback: async (whot, opts) => {
        const as = await db.collection("feedbacks").insertOne({
          email: opts.email,
          message: opts.message
        });
        return { ok: true };
      },
    },
  };
  schema = makeExecutableSchema({
    typeDefs,
    resolvers,
    // logger: console,
  });
  hasSetup = true;
};

module.exports = cors(async (req, res) => {

  if (!hasSetup) {
    await setup();
  }

  const url = parse(req.url)
  if (url.pathname === '/graphiql') {
    return microGraphiql({ endpointURL: '/' })(req, res)
  }

  return microGraphql({ schema })(req, res)

});
