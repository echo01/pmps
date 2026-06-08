exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE test_template
      ALTER COLUMN model_id DROP NOT NULL;

    CREATE TABLE IF NOT EXISTS test_template_model (
      id SERIAL PRIMARY KEY,
      template_id INT NOT NULL,
      model_id INT NOT NULL,
      is_primary BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT fk_test_template_model_template
        FOREIGN KEY (template_id)
        REFERENCES test_template(id)
        ON DELETE CASCADE,

      CONSTRAINT fk_test_template_model_model
        FOREIGN KEY (model_id)
        REFERENCES product_model(id)
        ON DELETE CASCADE,

      CONSTRAINT uq_test_template_model
        UNIQUE (template_id, model_id)
    );

    CREATE INDEX IF NOT EXISTS idx_test_template_model_template
      ON test_template_model(template_id);

    CREATE INDEX IF NOT EXISTS idx_test_template_model_model
      ON test_template_model(model_id);

    INSERT INTO test_template_model (template_id, model_id, is_primary)
    SELECT id, model_id, true
    FROM test_template
    WHERE model_id IS NOT NULL
    ON CONFLICT (template_id, model_id) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS test_template_model;
  `);
};
