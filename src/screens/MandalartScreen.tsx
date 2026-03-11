import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

const EMPTY_GRID = Array(9).fill(null).map(() => Array(9).fill(''));

export default function MandalartScreen() {
  const [grid, setGrid] = useState<string[][]>(EMPTY_GRID);
  const [focusedCell, setFocusedCell] = useState<[number, number] | null>(null);

  const updateCell = (row: number, col: number, value: string) => {
    setGrid((prev) => {
      const next = prev.map((r) => [...r]);
      next[row][col] = value;
      return next;
    });
  };

  // 9x9 그리드를 3x3 블록으로 나눠서 렌더링
  const getCellStyle = (row: number, col: number) => {
    const blockRow = Math.floor(row / 3);
    const blockCol = Math.floor(col / 3);
    const isCenter = blockRow === 1 && blockCol === 1;
    const isCenterCell = row === 4 && col === 4;
    const isFocused = focusedCell?.[0] === row && focusedCell?.[1] === col;

    return [
      styles.cell,
      isCenter && styles.centerBlock,
      isCenterCell && styles.centerCell,
      isFocused && styles.focusedCell,
      col % 3 === 2 && col !== 8 && styles.blockBorderRight,
      row % 3 === 2 && row !== 8 && styles.blockBorderBottom,
    ];
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>만다라트</Text>
        <TouchableOpacity
          onPress={() => setGrid(EMPTY_GRID.map((r) => [...r]))}
          style={styles.resetButton}
        >
          <Text style={styles.resetText}>초기화</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} horizontal>
        <ScrollView>
          <View style={styles.grid}>
            {grid.map((row, rowIdx) => (
              <View key={rowIdx} style={styles.row}>
                {row.map((cell, colIdx) => (
                  <TextInput
                    key={colIdx}
                    style={getCellStyle(rowIdx, colIdx)}
                    value={cell}
                    onChangeText={(v) => updateCell(rowIdx, colIdx, v)}
                    onFocus={() => setFocusedCell([rowIdx, colIdx])}
                    onBlur={() => setFocusedCell(null)}
                    multiline
                    textAlignVertical="center"
                    textAlign="center"
                    maxLength={20}
                  />
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const CELL_SIZE = 72;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1a1a2e' },
  resetButton: { padding: 8 },
  resetText: { color: '#ef4444', fontSize: 14 },
  scrollContent: { padding: 12 },
  grid: { borderWidth: 2, borderColor: '#333' },
  row: { flexDirection: 'row' },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderWidth: 0.5,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    fontSize: 11,
    padding: 4,
    color: '#1a1a2e',
  },
  centerBlock: { backgroundColor: '#f0edff' },
  centerCell: { backgroundColor: '#4f46e5', color: '#fff', fontWeight: 'bold' },
  focusedCell: { borderColor: '#4f46e5', borderWidth: 2 },
  blockBorderRight: { borderRightWidth: 2, borderRightColor: '#555' },
  blockBorderBottom: { borderBottomWidth: 2, borderBottomColor: '#555' },
});
