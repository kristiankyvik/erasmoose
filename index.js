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
  review_count: Int
  danceclub_cost: AverageProperty
  city_recommendation: AverageProperty
  student_friendliness: AverageProperty
  leisure: String
  nightlife: AverageProperty
  gastronomy: AverageProperty
  sports: AverageProperty
}
type ReviewsMeta { 
  unisCount: Int,
  reviewCount: Int
}

type Review {
  uni_review: String
  city_review: String
  date_submit: String
  _id: String
}

type Query {
  allUnis(first: Int, skip: Int, searchObj: String): [University]
  _allUnisMeta: Meta
  _allReviewsMeta: ReviewsMeta
  getReviews(city_id: String, university_id: String): [Review]
}

type Success {
  ok: Boolean
}

type Mutation {
  updateUniversity(_id: String, votes: Int): University
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
let hasSetup = false;

const setup = async () => {

  const db = await MongoClient.connect(process.env.MLAB_URL);
        
  const createQueryObject = (opts) => (
    JSON.parse(opts.searchObj).concat([
      {
        $skip: opts.skip
      },
      {
        $limit: opts.first
      }
    ])
  )

  resolvers = {

    Query: {
      allUnis: async (_, opts) => {
        // DO NOT REMOVE CONSOLE.LOG
        console.log(JSON.stringify(opts)); 
        console.log(JSON.stringify(createQueryObject(opts)));
        return await db.collection("universities").aggregate(
          createQueryObject(opts)
        ).toArray();
      },
      _allUnisMeta: async () => {
        const count = await db.collection("universities").count(); 
        return { count };
      },
      getReviews: async (_, opts) => {
        const attrib = Object.keys(opts)[0] == 'city_id' ? 'city_review' : 'uni_review';
        opts[attrib] = {$exists: true};
        opts["$where"] = `this.${attrib}.length > 40`; 
        return await db.collection("reviews").find(opts, {}).toArray();
      },
      _allReviewsMeta: async () => {
        const metaCursor =  await db.collection('universities').aggregate([
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
    logger: false,
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
