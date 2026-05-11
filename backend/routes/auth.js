const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'ticketin_super_secret_key_12345';

router.post('/register', async (req, res) => {
    try {
        const { accountName, password, email } = req.body;
        
        if (!accountName || !password) {
            return res.status(400).json({ error: 'Account name and password are required' });
        }

        const existingUser = await User.findOne({ accountName });
        if (existingUser) {
            return res.status(409).json({ error: 'Account name already taken' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            accountName,
            email,
            password: hashedPassword
        });

        await newUser.save();

        const token = jwt.sign({ userId: newUser._id, accountName: newUser.accountName }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({ 
            message: 'User registered successfully',
            token,
            accountName: newUser.accountName
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { accountName, email, identifier, password } = req.body;
        const loginId = (identifier ?? accountName ?? email ?? '').trim();

        if (!loginId || !password) {
            return res.status(400).json({ error: 'Account name or email and password are required' });
        }

        const user = await User.findOne({
            $or: [{ accountName: loginId }, { email: loginId }]
        });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user._id, accountName: user.accountName }, JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({ 
            message: 'Login successful',
            token,
            accountName: user.accountName
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        user.email = email;
        await user.save();
        
        res.json({ message: 'Profile updated', user: { accountName: user.accountName, email: user.email } });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/password', authMiddleware, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Incorrect old password' });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
module.exports.JWT_SECRET = JWT_SECRET;
