const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../database');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const { isEmailConfigured, sendPasswordResetEmail } = require('../services/emailService');

const router = express.Router();

// Email regex helper
const validateEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const resetRequestMessage = 'If an account exists for that email, reset instructions have been created.';

// 1. REGISTER
router.post('/register', (req, res) => {
  const { full_name, email, password } = req.body;

  // Basic validations
  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  // Check duplicate email
  db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error occurred.' });
    }
    if (row) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    // Hash password
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        return res.status(500).json({ error: 'Encryption error.' });
      }

      // Insert User
      db.run(
        'INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)',
        [full_name, email.toLowerCase(), hash],
        function (err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to register user.' });
          }

          // Generate Token automatically for login on register
          const token = jwt.sign({ id: this.lastID, email: email.toLowerCase() }, JWT_SECRET, { expiresIn: '24h' });

          res.status(201).json({
            message: 'User registered successfully.',
            token,
            user: {
              id: this.lastID,
              full_name,
              email: email.toLowerCase()
            }
          });
        }
      );
    });
  });
});

// 2. LOGIN
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error.' });
    }
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Check password
    bcrypt.compare(password, user.password_hash, (err, isMatch) => {
      if (err) {
        return res.status(500).json({ error: 'Verification error.' });
      }
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid email or password.' });
      }

      // Sign JWT
      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

      res.json({
        message: 'Login successful.',
        token,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email
        }
      });
    });
  });
});

// 3. GET PROFILE
router.get('/profile', authenticateToken, (req, res) => {
  db.get('SELECT id, full_name, email, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error.' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(user);
  });
});

// 4. UPDATE PROFILE
router.put('/profile', authenticateToken, (req, res) => {
  const { full_name } = req.body;

  if (!full_name || full_name.trim() === '') {
    return res.status(400).json({ error: 'Full Name cannot be empty.' });
  }

  db.run(
    'UPDATE users SET full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [full_name, req.user.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update profile.' });
      }
      res.json({ message: 'Profile updated successfully.', full_name });
    }
  );
});

// 5. CHANGE PASSWORD
router.put('/change-password', authenticateToken, (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  // Get user details
  db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error.' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Verify current password
    bcrypt.compare(current_password, user.password_hash, (err, isMatch) => {
      if (err) {
        return res.status(500).json({ error: 'Verification error.' });
      }
      if (!isMatch) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
      }

      // Hash new password
      bcrypt.hash(new_password, 10, (err, hash) => {
        if (err) {
          return res.status(500).json({ error: 'Encryption error.' });
        }

        // Update DB
        db.run(
          'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [hash, req.user.id],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to update password.' });
            }
            res.json({ message: 'Password changed successfully.' });
          }
        );
      });
    });
  });
});

// 6. REQUEST PASSWORD RESET
router.post('/forgot-password', (req, res) => {
  const email = req.body?.email?.trim().toLowerCase();
  if (!email || !validateEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  db.get('SELECT id, email, full_name FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error.' });
    if (!user) return res.json({ message: resetRequestMessage });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    db.serialize(() => {
      db.run('DELETE FROM password_reset_tokens WHERE user_id = ? OR expires_at < CURRENT_TIMESTAMP', [user.id]);
      db.run(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        [user.id, tokenHash, expiresAt],
        async (insertErr) => {
          if (insertErr) return res.status(500).json({ error: 'Failed to create password reset request.' });

          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
          if (process.env.NODE_ENV !== 'production') {
            return res.json({ message: resetRequestMessage, reset_url: resetUrl });
          }

          try {
            await sendPasswordResetEmail({ email: user.email, fullName: user.full_name, resetUrl });
            res.json({ message: resetRequestMessage });
          } catch (emailError) {
            console.error('Password reset email failed:', emailError.message);
            db.run('DELETE FROM password_reset_tokens WHERE token_hash = ?', [tokenHash]);
            res.status(503).json({ error: 'Password reset is temporarily unavailable. Please try again later.' });
          }
        }
      );
    });
  });
});

// 7. RESET PASSWORD WITH A ONE-TIME TOKEN
router.post('/reset-password', (req, res) => {
  const { token, new_password: newPassword } = req.body || {};
  if (!token || !newPassword) return res.status(400).json({ error: 'Reset token and new password are required.' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters long.' });

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  db.get(
    `SELECT id, user_id FROM password_reset_tokens
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
    [tokenHash],
    (err, resetToken) => {
      if (err) return res.status(500).json({ error: 'Database error.' });
      if (!resetToken) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });

      bcrypt.hash(newPassword, 10, (hashErr, hash) => {
        if (hashErr) return res.status(500).json({ error: 'Encryption error.' });
        db.serialize(() => {
          db.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hash, resetToken.user_id]);
          db.run('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [resetToken.id], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: 'Failed to reset password.' });
            res.json({ message: 'Password reset successfully. You can now sign in.' });
          });
        });
      });
    }
  );
});

module.exports = router;
