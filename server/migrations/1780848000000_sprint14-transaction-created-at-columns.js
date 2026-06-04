exports.up = async (pgm) => {
  pgm.addColumns('inspection_header', {
    created_at: {
      type: 'timestamp',
      notNull: false,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  }, { ifNotExists: true });

  pgm.addColumns('inspection_detail', {
    created_at: {
      type: 'timestamp',
      notNull: false,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  }, { ifNotExists: true });

  pgm.addColumns('qa_sample_detail', {
    created_at: {
      type: 'timestamp',
      notNull: false,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  }, { ifNotExists: true });
};

exports.down = async (pgm) => {
  pgm.dropColumns('qa_sample_detail', ['created_at'], { ifExists: true });
  pgm.dropColumns('inspection_detail', ['created_at'], { ifExists: true });
  pgm.dropColumns('inspection_header', ['created_at'], { ifExists: true });
};
