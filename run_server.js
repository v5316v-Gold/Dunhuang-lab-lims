require('dotenv').config();
process.env.PORT = '3099';
console.log('[DIAG] After override PORT=' + process.env.PORT);
require('./server.js');
