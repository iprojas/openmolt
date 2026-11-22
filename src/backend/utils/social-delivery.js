async function deliverAfterCommit(operation, deliver) {
  try {
    await deliver();
  } catch (error) {
    const code = String(error?.code || error?.name || 'unknown').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 64);
    console.warn('CHILE2 social notification failed after commit.', { operation, code });
  }
}

module.exports = { deliverAfterCommit };
