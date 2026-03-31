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

module.exports = router;
