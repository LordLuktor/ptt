const express = require('express');
const http = require('http');
const { ApolloServer } = require('apollo-server-express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { sequelize } = require('./config/db');
const typeDefs = require('./graphql/typeDefs');
const resolvers = require('./graphql/resolvers');
const authMiddleware = require('./middleware/auth');
const pttSocket = require('./sockets/pttSocket');

// Express app
const app = express();
app.use(cors());
app.use(express.json());

// REST routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', authMiddleware, require('./routes/users'));
app.use('/api/orgs', authMiddleware, require('./routes/orgs'));
app.use('/api/groups', authMiddleware, require('./routes/groups'));
app.use('/api/channels', authMiddleware, require('./routes/channels'));
app.use('/api/locations', authMiddleware, require('./routes/locations'));
app.use('/api/subscriptions', authMiddleware, require('./routes/subscriptions'));

// GraphQL Apollo setup
async function startApolloServer() {
    const server = new ApolloServer({
        typeDefs,
        resolvers,
        context: ({ req }) => {
            // Pass authenticated user to GraphQL context
            const token = req.headers.authorization?.replace('Bearer ', '');
            let user = null;
            if (token) {
                try {
                    user = jwt.verify(token, process.env.JWT_SECRET);
                } catch (e) {
                    // ignore
                }
            }
            return { user, sequelize };
        },
    });
    await server.start();
    server.applyMiddleware({ app, path: '/graphql' });
}
startApolloServer();

// Socket.io setup
const httpServer = http.createServer(app);
pttSocket(httpServer);

// DB sync
sequelize.sync().then(() => {
    console.log('Database synced.');
    httpServer.listen(4000, () => {
        console.log('Server listening on port 4000');
    });
});