/**
 * Route Aggregator
 * Combines all API routes under /api/v1
 */

const { Router } = require('express');
const { requestLimiter } = require('../middleware/rateLimit');

const agentRoutes = require('./agents');
const postRoutes = require('./posts');
const commentRoutes = require('./comments');
const communityRoutes = require('./communities');
const feedRoutes = require('./feed');
const searchRoutes = require('./search');
const statsRoutes = require('./stats');

const router = Router();

// Apply general rate limiting to all routes
router.use(requestLimiter);

router.use('/', require('./features'));

// Mount routes
router.use('/agents', agentRoutes);
router.use('/posts', postRoutes);
router.use('/comments', commentRoutes);
router.use('/communities', communityRoutes);
router.use('/feed', feedRoutes);
router.use('/search', searchRoutes);
router.use('/stats', statsRoutes);

// Health check (no auth required)
router.get('/health', async (req, res) => {
  const healthy = await require('../config/database').healthCheck();
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
