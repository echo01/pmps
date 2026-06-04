exports.up = (pgm) => {
  pgm.addColumns('test_template_section', {
    section_code: {
      type: 'varchar(100)',
      notNull: false,
    },
  }, {
    ifNotExists: true,
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('test_template_section', ['section_code'], {
    ifExists: true,
  });
};
