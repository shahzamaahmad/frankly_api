const express = require('express');
const { fetchById, fetchMany, deleteRow, updateRow } = require('../lib/db');
const { deleteSupabaseUser, updateSupabaseUser } = require('../lib/auth');
const { buildFullName, sanitizeUser } = require('../lib/users');
const checkPermission = require('../middlewares/checkPermission');

const router = express.Router();

router.get('/', checkPermission('viewEmployees'), async (req, res) => {
  try {
    const users = await fetchMany('users', { orderBy: 'createdAt', ascending: false });
    res.json(users.map((user) => sanitizeUser(user)));
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id', checkPermission('viewEmployees'), async (req, res) => {
  try {
    const user = sanitizeUser(await fetchById('users', req.params.id));
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', checkPermission('editEmployees'), async (req, res) => {
  try {
    const updates = { ...req.body };

    if (updates.username && updates.username.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters' });
    }

    const currentUser = await fetchById('users', req.params.id);
    if (!currentUser) return res.status(404).json({ message: 'User not found' });

    const nextFullName = updates.fullName || buildFullName({
      ...currentUser,
      ...updates,
    });
    if (nextFullName) {
      updates.fullName = nextFullName;
    }

    const permissionsChanged = updates.permissions &&
      JSON.stringify(currentUser.permissions || {}) !== JSON.stringify(updates.permissions);

    if (updates.password) {
      await updateSupabaseUser(currentUser, {
        password: updates.password,
        email: updates.email,
        username: updates.username,
        fullName: updates.fullName,
        role: updates.role,
      });
      delete updates.password;
    } else {
      await updateSupabaseUser(currentUser, {
        email: updates.email,
        username: updates.username,
        fullName: updates.fullName,
        role: updates.role,
      });
    }

    delete updates._id;
    delete updates.id;
    delete updates.createdAt;

    const updatedUser = sanitizeUser(await updateRow('users', req.params.id, updates));

    if (permissionsChanged && global.io) {
      global.io.to(`user:${req.params.id}`).emit('permissionsUpdated', { permissions: updatedUser.permissions });
    }

    if (global.io) {
      global.io.emit('user:updated', { id: req.params.id });
    }

    res.json(updatedUser);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

  router.delete('/:id', checkPermission('deleteEmployees'), async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const existingUser = await fetchById('users', req.params.id);
    if (!existingUser) return res.status(404).json({ message: 'User not found' });

    await deleteSupabaseUser(existingUser);
    const user = await deleteRow('users', req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /users/{id}/assign-asset:
 *   post:
 *     summary: Assign asset to employee
 *     description: Assigns an inventory item to an employee and updates stock
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - item
 *               - quantity
 *               - condition
 *             properties:
 *               item:
 *                 type: string
 *                 description: Inventory item ID
 *               quantity:
 *                 type: integer
 *                 description: Quantity to assign
 *               condition:
 *                 type: string
 *                 enum: [new, used, damaged]
 *                 description: Asset condition
 *               remarks:
 *                 type: string
 *                 description: Optional remarks
 *     responses:
 *       200:
 *         description: Asset assigned successfully
 *       400:
 *         description: Insufficient stock
 *       404:
 *         description: User or item not found
 *       500:
 *         description: Internal server error
 */
router.post('/:id/assign-asset', checkPermission('editEmployees'), async (req, res) => {
  try {
    const { item, quantity, condition, remarks } = req.body;

    const [user, inventoryItem, transactions, users] = await Promise.all([
      fetchById('users', req.params.id),
      fetchById('inventory', item),
      fetchMany('transactions', { filters: [{ column: 'item', operator: 'eq', value: item }] }),
      fetchMany('users'),
    ]);

    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!inventoryItem) return res.status(404).json({ message: 'Item not found' });

    let issued = 0;
    let returned = 0;
    for (const transaction of transactions) {
      if (transaction.type === 'ISSUE') issued += Number(transaction.quantity || 0);
      if (transaction.type === 'RETURN') returned += Number(transaction.quantity || 0);
    }

    let assignedToEmployees = 0;
    for (const candidate of users) {
      for (const asset of candidate.assets || []) {
        if (String(asset.item) === String(item)) {
          assignedToEmployees += Number(asset.quantity || 0);
        }
      }
    }

    const currentStock = Number(inventoryItem.initialStock || 0) - issued + returned - assignedToEmployees;
    if (currentStock < Number(quantity)) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }

    const nextAssets = Array.isArray(user.assets) ? [...user.assets] : [];
    nextAssets.push({
      item,
      quantity: Number(quantity),
      condition,
      remarks,
    });

    await updateRow('users', req.params.id, { assets: nextAssets });

    res.json({ message: 'Asset assigned successfully' });
  } catch (err) {
    console.error('Assign asset error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
