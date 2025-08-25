// src/routes/applyEdit.js
const express = require('express');
const router = express.Router();

/**
 * Endpoint utilizado pelos plugins de edição inline (Hostinger/Horizons).
 * Em PRODUÇÃO, mantemos como "no-op" (sem alterar arquivos),
 * apenas para não quebrar o fluxo do editor visual.
 *
 * Para habilitar gravação (apenas se você quiser em ambiente controlado),
 * defina ALLOW_INLINE_EDIT=1 e trate a escrita do jeito que preferir.
 */

router.post('/', (req, res) => {
  const enabled = process.env.ALLOW_INLINE_EDIT === '1';

  if (!enabled) {
    return res.status(200).json({
      success: true,
      applied: false,
      reason: 'inline_edit_disabled',
    });
  }

  // Quando habilitado, apenas ecoa. (Você pode implementar gravação em repositório se quiser.)
  const { editId, newFullText } = req.body || {};
  if (!editId || typeof newFullText === 'undefined') {
    return res.status(400).json({ success: false, error: 'missing_fields' });
  }

  // Aqui seria a lógica de aplicar patch em arquivo (desaconselhado em produção).
  return res.json({
    success: true,
    applied: false,
    echo: { editId, newFullText },
  });
});

module.exports = router;
