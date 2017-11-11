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
  uni_rating: Float
  int_orientation: Float
  workload: Float
  fees: Float
  opportunities: Float
  openness: Float
  clubs: Float
  party: Float
  female_percentage: Float
  reviews_count: Float
  main_disciplines: [Property]
  languages: [Property]
}

type Property {
  name: String
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
  travel_options: Float
  rent_cost: Float
  beer_cost: Float
  coffee_cost: Float
  kebab_cost: Float
  monthly_cost: Float
  culture: Float
  if_you_like: [String]
  reviews_count: Int
  danceclub_cost: Float
  city_rating: Float
  leisure: String
}

type Query {
  allUnis(first: Int, skip: Int, searchKey: String): [University]
  getCity(_id: String): City
  _allUnisMeta: Meta
}

type Mutation {
  updateUniversity(_id: String, votes: Int): University
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
        // EVER
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
            sort: { uni_rating: -1 },
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
    },
  };
  schema = makeExecutableSchema({
    typeDefs,
    resolvers,
    // logger: console,
  });
  hasSetup = true;
};

module.exports = cors( async (req, res) => {

    if (!hasSetup) {
      await setup();
    }

    const url = parse(req.url)
    if(url.pathname === '/graphiql') {
        return microGraphiql({endpointURL: '/'})(req, res)
    }

    return microGraphql({ schema })(req, res)
    
});