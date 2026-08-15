
const { Logger } = require('@nestjs/common');
const logger = new Logger('Test');
try { logger.error('msg', undefined); console.log('ok'); } catch (e) { console.log('FAIL:', e.message); }
