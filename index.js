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
  uni_recommendation: AverageProperty
  int_orientation: AverageProperty
  workload: AverageProperty
  fees: AverageProperty
  opportunities: AverageProperty
  openness: AverageProperty
  clubs: AverageProperty
  party: AverageProperty
  female_percentage: AverageProperty
  review_count: Int
  main_disciplines: [Property]
  languages: [Property]
  difficulty: AverageProperty
  weekly_hours: AverageProperty
  cityRating: Float
  uniRating: Float
  overallRating: Float
  city: City
  easiness: Float
  cheapness: Float
  free_time: Float
  uni_cheapness: Float
  reviews: [Review]
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

type DistinctCountries {
  countries: [String]
}

type DistinctLanguages {
  languages: [String]
}

type DistinctAreas {
  areas: [String]
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
  review_count: Int
  danceclub_cost: AverageProperty
  city_recommendation: AverageProperty
  student_friendliness: AverageProperty
  leisure: String
  nightlife: AverageProperty
  gastronomy: AverageProperty
  sports: AverageProperty
  city_cheapness: Float
}
type ReviewsMeta { 
  unisCount: Int,
  reviewCount: Int
}

type Review {
  _id: String
  text: String
  votes: Int
  date: String
}

type Query {
  allUnis(first: Int, skip: Int, searchObj: String): [University]
  _allUnisMeta: Meta
  _allReviewsMeta: ReviewsMeta
  distinctCountries: [String]
  distinctLanguages: [String]
  distinctAreas: [String]
  reviews(entity_id: String, type: String): [Review]
}

type Success {
  ok: Boolean
}

type UpdatedVotes {
  entity_id: String
  votes: Int
  type: String
}

type Mutation {
  updateVotes(_id: String, votes: Int, entity_id: String, type: String): UpdatedVotes 
  sendFeedback(email: String, message: String): Success
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

MongoClient.connect(process.env.MLAB_URL, (err, client) => {
  
  console.log('hallo')
  console.log(client)
  console.log(process.env.MLAB_URL)
  var db = client.db('unirank');

  const createQueryObject = (opts) => (
    JSON.parse(opts.searchObj).concat([
      {
        $skip: opts.skip
      },
      {
        $limit: opts.first
      }
    ])
  );

  resolvers = {

    Query: {
      allUnis: async (_, opts) => {
        return await db.collection("universities").aggregate(
          createQueryObject(opts)
        ).toArray();
      },
      _allUnisMeta: async () => {
        const count = await db.collection("universities").count();
        return { count };
      },
      distinctCountries: async () => {
        return await db.collection("cities").distinct('country');
      },
      distinctLanguages: async () => {
        return await db.collection("universities").distinct('languages.name');
      },
      distinctAreas: async () => {
        return await db.collection("universities").distinct('main_disciplines.name');
      },
      _allReviewsMeta: async () => {
        const metaCursor = await db.collection('universities').aggregate([
          {
            $match: {
              'review_count': { $gt: 0 }
            }
          },
          {
            $group: {
              _id: '',
              reviewCount: {
                $sum: "$review_count"
              },
              unisCount: {
                $sum: 1
              }
            }
          }
        ]).toArray();
        return metaCursor[0];
      },
      reviews: async (_, opts) => {
        console.log("opts",opts);
        const entity = await db.collection(opts.type).aggregate([
          {
            $match: {
              '_id': new ObjectId(opts.entity_id)
            }
          }
        ]).toArray();
        return entity[0].reviews
      }
    },
    Mutation: {
      updateVotes: async (whot, opts) => {
        console.log("opts",opts);

        await db.collection(opts.type).update(
          {
            "_id": new ObjectId(opts.entity_id),
            "reviews._id": new ObjectId(opts._id)
          },
          {
            $set: { "reviews.$.votes": opts.votes }
          }
        );
        result = db.collection(opts.type).find(
          {
            "_id": new ObjectId(opts.entity_id) 
          }
        )
        
        console.log("result",result)
        // return result['reviews']
        return { 
           entity_id: opts.entity_id, 
           votes: opts.votes,
           type: opts.type
        };
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
    logger: false,
  });
})

module.exports = cors( async (req, res) => {
  
  const url = parse(req.url)
  if (url.pathname === '/graphiql') {
    return microGraphiql({ endpointURL: '/' })(req, res)
  }

  return microGraphql({ schema })(req, res)
});


