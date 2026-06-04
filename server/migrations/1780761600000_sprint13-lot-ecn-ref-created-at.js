exports.up = async (pgm) => {
  pgm.addColumns('lot_ecn_ref', {
    created_at: {
      type: 'timestamp',
      notNull: false,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  }, { ifNotExists: true });
};

exports.down = async (pgm) => {
  pgm.dropColumns('lot_ecn_ref', ['created_at'], { ifExists: true });
};
