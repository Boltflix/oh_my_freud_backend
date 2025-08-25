// src/routes/applyEdit.js
const express = require('express');
const router = express.Router();

/**
 * Usado pelos plugins de edição inline (Hostinger/Horizons).
 * Em produção, mantemos como NO-OP (não altera arquivos).
 * Para habilitar em ambiente controlado, defina ALLOW_INLINE_EDIT=1.
 */
router.post('/', (req, res) => {
  const enabled = process.env.ALLOW_INLINE_EDIT === '1';
  if (!enabled) {
    return res.status(200).json({ success: true, applied: false, reason: 'inline_edit_disabled' });
  }
  const { editId, newFullText } = req.body || {};
  if (!editId || typeof newFullText === 'undefined') {
    return res.status(400).json({ success: false, error: 'missing_fields' });
  }
  // Aqui entraria sua lógica de commit/patch se você quiser implementar.
  return res.json({ success: true, applied: false, echo: { editId, newFullText } });
});

module.exports = router;
