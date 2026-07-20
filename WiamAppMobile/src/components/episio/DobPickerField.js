/**
 * Modal day / month / year picker. Returns YYYY-MM-DD via onChange.
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform,
} from 'react-native';
import { COLORS, FONTS } from '../../constants/theme';
import EpisioGoldButton from './EpisioGoldButton';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

function pad(n) {
  return String(n).padStart(2, '0');
}

export function dobLabel(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'Select date of birth';
  const [y, m, d] = iso.split('-').map(Number);
  return `${pad(d)} ${MONTHS[m - 1]} ${y}`;
}

const Col = ({ data, value, onChange, labelFn }) => (
  <ScrollView
    style={styles.wheel}
    showsVerticalScrollIndicator={false}
    contentContainerStyle={{ paddingVertical: 40 }}
  >
    {data.map((item) => {
      const active = item === value;
      return (
        <TouchableOpacity
          key={String(item)}
          style={[styles.wheelItem, active && styles.wheelItemOn]}
          onPress={() => onChange(item)}
        >
          <Text style={[styles.wheelText, active && styles.wheelTextOn]}>
            {labelFn ? labelFn(item) : item}
          </Text>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

const DobPickerField = ({ value, onChange, style }) => {
  const now = new Date();
  const maxYear = now.getFullYear() - 13;
  const minYear = now.getFullYear() - 100;

  const parse = (iso) => {
    if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const [y, m, d] = iso.split('-').map(Number);
      return { day: d, month: m, year: y };
    }
    return { day: 1, month: 1, year: maxYear - 5 };
  };

  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(() => parse(value).day);
  const [month, setMonth] = useState(() => parse(value).month);
  const [year, setYear] = useState(() => parse(value).year);

  const years = useMemo(() => {
    const list = [];
    for (let y = maxYear; y >= minYear; y -= 1) list.push(y);
    return list;
  }, [maxYear, minYear]);

  const days = useMemo(
    () => Array.from({ length: daysInMonth(month, year) }, (_, i) => i + 1),
    [month, year],
  );

  const openPicker = () => {
    const p = parse(value);
    setYear(p.year);
    setMonth(p.month);
    setDay(Math.min(p.day, daysInMonth(p.month, p.year)));
    setOpen(true);
  };

  const confirm = () => {
    const maxD = daysInMonth(month, year);
    const d = Math.min(day, maxD);
    onChange(`${year}-${pad(month)}-${pad(d)}`);
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity style={[styles.field, style]} onPress={openPicker} activeOpacity={0.85}>
        <Text style={[styles.fieldText, !value && styles.placeholder]}>{dobLabel(value)}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, Platform.OS === 'ios' && { paddingBottom: 28 }]}>
            <Text style={styles.title}>Date of birth</Text>
            <View style={styles.wheels}>
              <Col
                data={days}
                value={Math.min(day, daysInMonth(month, year))}
                onChange={setDay}
              />
              <Col
                data={MONTHS.map((_, i) => i + 1)}
                value={month}
                onChange={setMonth}
                labelFn={(m) => MONTHS[m - 1]}
              />
              <Col data={years} value={year} onChange={setYear} />
            </View>
            <EpisioGoldButton label="Use this date" onPress={confirm} style={{ marginTop: 8 }} />
            <TouchableOpacity onPress={() => setOpen(false)} style={{ marginTop: 12 }}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  field: { flex: 1, paddingVertical: 2 },
  fieldText: { color: '#fff', fontFamily: FONTS.regular, fontSize: 13.5 },
  placeholder: { color: COLORS.textFaint },
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.navyCard,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    maxHeight: '70%',
  },
  title: {
    fontFamily: FONTS.bold, fontSize: 16, color: '#fff', textAlign: 'center', marginBottom: 12,
  },
  wheels: { flexDirection: 'row', height: 220, marginBottom: 8 },
  wheel: { flex: 1 },
  wheelItem: {
    paddingVertical: 10, alignItems: 'center', borderRadius: 10, marginHorizontal: 4,
  },
  wheelItemOn: { backgroundColor: 'rgba(212,160,23,0.18)' },
  wheelText: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textDim },
  wheelTextOn: { color: COLORS.gold, fontFamily: FONTS.bold },
  cancel: { textAlign: 'center', color: COLORS.textFaint, fontFamily: FONTS.semi, fontSize: 13 },
});

export default DobPickerField;
