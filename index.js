require('dotenv').config()
require('request'); // needed to force webpack to load request lib

const rp = require('request-promise');
const { parse } = require('url')
const { microGraphql, microGraphiql } = require('graphql-server-micro')
const { makeExecutableSchema } = require('graphql-tools')
const cors = require('micro-cors')();
const { MongoClient } = require('mongodb');

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
}

type Meta {   
  count: Int
}

type Query {
  allUnis(first: Int, skip: Int, searchKey: String): [University]
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
                city: {
                  '$regex': opts.searchKey,
                  '$options': 'i'
                }
              }   
            ]
          },
          {
            limit: opts.first,
            skip: opts.skip,
            sort: { name: 1 },
          }
        ).toArray();
      },
      _allUnisMeta: async () => {
        const count = await db.collection("universities").count(); 
        return { count };
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
    },
  };
  schema = makeExecutableSchema({
    typeDefs,
    resolvers,
    logger: console,
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