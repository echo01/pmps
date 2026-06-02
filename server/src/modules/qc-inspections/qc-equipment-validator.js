function groupByEquipmentType(equipment) {
  return equipment.reduce((map, row) => {
    const key = row.equipment_type_id;
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
}

function validateQcEquipment({ equipmentIds, equipment, requiredEquipment }) {
  const uniqueIds = [...new Set(equipmentIds)];
  const foundIds = new Set(equipment.map((row) => row.id));
  const selectedByType = groupByEquipmentType(equipment);

  const missing = uniqueIds.filter((equipmentId) => !foundIds.has(equipmentId));
  const inactive = equipment.filter((row) => row.status !== 'ACTIVE');
  const expired = equipment.filter((row) => {
    if (!row.calibration_due_date) {
      return true;
    }

    return new Date(row.calibration_due_date) < new Date(new Date().toISOString().slice(0, 10));
  });
  const missingRequired = requiredEquipment
    .filter((row) => row.mandatory)
    .filter((row) => (selectedByType.get(row.equipment_type_id) || 0) < row.required_qty)
    .map((row) => ({
      equipment_type_id: row.equipment_type_id,
      equipment_type_code: row.equipment_type_code,
      required_qty: row.required_qty,
      selected_qty: selectedByType.get(row.equipment_type_id) || 0,
    }));

  const valid = missing.length === 0
    && inactive.length === 0
    && expired.length === 0
    && missingRequired.length === 0;

  return {
    valid,
    missing,
    inactive,
    expired,
    missing_required: missingRequired,
    summary: {
      missing_count: missing.length,
      inactive_count: inactive.length,
      expired_count: expired.length,
      missing_required_count: missingRequired.length,
    },
  };
}

module.exports = {
  validateQcEquipment,
};
