import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import type { InventoryPiece, PieceType } from '../lib/models';
import { pieceCount, type Assignment } from '../lib/inventory';
import { ChevronDownIcon, SmallChevronRightIcon } from './icons';

const byNumber = (a: string, b: string) => parseInt(a, 10) - parseInt(b, 10);

export default function PieceCard({
  piece,
  pieces,
  repairCount,
  dirtyCount,
  onFlagPress,
  onSizePress,
  chipStateFor,
  assignmentFor,
  matches,
}: {
  piece: PieceType;
  // This type's pieces.
  pieces: InventoryPiece[];
  repairCount: number;
  dirtyCount: number;
  onFlagPress: (piece: PieceType, kind: 'repair' | 'dirty') => void;
  onSizePress: (color: string, size: string) => void;
  chipStateFor: (color: string, size: string) => 'repair' | 'dirty' | null;
  assignmentFor: (piece: InventoryPiece) => Assignment;
  // Whether a piece passes the screen's active filters (only matching chips render).
  matches: (piece: InventoryPiece) => boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  // Numbered types: a chip per piece number, grouped by color. Counted types: a stock row per color.
  const groups = piece.colors
    .map((color) => {
      const all = pieces.filter((p) => p.color === color);
      const shown = all.filter(matches).sort((a, b) => byNumber(a.number, b.number));
      return {
        color,
        total: all.length,
        assigned: all.filter((p) => assignmentFor(p).state === 'assigned').length,
        shown: shown.map((p) => ({ number: p.number, state: assignmentFor(p).state })),
      };
    })
    .filter((g) => g.shown.length > 0 || pieces.length === 0);
  const assignedTotal = pieces.filter((p) => assignmentFor(p).state === 'assigned').length;
  const present = new Set(groups.flatMap((g) => g.shown.map((x) => x.state)));
  const rows = piece.colors.map((color) => ({ name: color, qty: piece.stock[color] ?? 0 }));
  const hasTintedChip =
    piece.kind === 'numbered' &&
    groups.some((g) => g.shown.some((x) => chipStateFor(g.color, x.number) !== null));

  return (
    <View style={styles.piece}>
      <Pressable style={styles.pieceRow} onPress={() => setIsOpen((prev) => !prev)}>
        <View>
          <Text style={styles.pieceName}>{piece.name}</Text>
          <Text style={styles.pieceSub}>{piece.colors.join(', ')}</Text>
        </View>
        <View style={styles.pieceRight}>
          <View>
            <Text style={styles.pieceQty}>
              {piece.kind === 'numbered'
                ? `${assignedTotal} / ${pieceCount(piece, pieces)} assigned`
                : pieceCount(piece, pieces)}
            </Text>
            {(repairCount > 0 || dirtyCount > 0) && (
              <View style={styles.statusTags}>
                {repairCount > 0 && (
                  <Pressable
                    style={styles.flagBtnRepair}
                    onPress={() => onFlagPress(piece, 'repair')}
                  >
                    <Text style={styles.flagBtnTextRepair}>Repair · {repairCount}</Text>
                    <SmallChevronRightIcon color={colors.rust} />
                  </Pressable>
                )}
                {dirtyCount > 0 && (
                  <Pressable style={styles.flagBtnDirty} onPress={() => onFlagPress(piece, 'dirty')}>
                    <Text style={styles.flagBtnTextDirty}>Dirty · {dirtyCount}</Text>
                    <SmallChevronRightIcon color={colors.wash} />
                  </Pressable>
                )}
              </View>
            )}
          </View>
          <ChevronDownIcon color={colors.inkFaint} open={isOpen} />
        </View>
      </Pressable>

      {isOpen && (
        <View style={styles.breakdown}>
          {(() => {
            return piece.kind === 'numbered'
              ? groups.map((group) => (
                <View key={group.color} style={styles.colorGroup}>
                  <View style={styles.colorHead}>
                    <Text style={styles.colorName}>{group.color}</Text>
                    <Text style={styles.colorMeta}>
                      {group.assigned} of {group.total} assigned
                    </Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipStrip}
                  >
                    {group.shown.map(({ number: size, state: assign }) => {
                      const state = chipStateFor(group.color, size);
                      return (
                        <Pressable
                          key={size}
                          style={[
                            styles.sizeChip,
                            assign === 'assigned' && styles.chipAssigned,
                            assign === 'unassigned' && styles.chipUnassigned,
                            assign === 'out_for_repair' && styles.chipOut,
                            state === 'repair' && styles.sizeChipRepair,
                            state === 'dirty' && styles.sizeChipDirty,
                          ]}
                          onPress={() => onSizePress(group.color, size)}
                          accessibilityLabel={`${group.color} ${size} history`}
                        >
                          <Text
                            style={[
                              styles.sizeChipText,
                              state === 'repair' && styles.sizeChipTextRepair,
                              state === 'dirty' && styles.sizeChipTextDirty,
                            ]}
                          >
                            {size}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ))
              : rows.map((row, index) => (
                  <View
                    key={row.name}
                    style={[
                      styles.styleRow,
                      index === rows.length - 1 && styles.styleRowLast,
                    ]}
                  >
                    <Text style={styles.styleName}>{row.name}</Text>
                    <Text style={styles.styleQty}>{row.qty}</Text>
                  </View>
                ));
          })()}
          {piece.kind === 'numbered' && (present.size > 0 || hasTintedChip) && (
            <Text style={styles.legend}>
              {[
                present.has('assigned') && <Text key="a" style={{ color: colors.ink }}>Assigned</Text>,
                present.has('unassigned') && <Text key="u" style={{ color: colors.inkFaint }}>Unassigned</Text>,
                present.has('out_for_repair') && <Text key="o" style={{ color: colors.amber }}>Out for repair</Text>,
                hasTintedChip && <Text key="r" style={{ color: colors.rust }}>Repair</Text>,
                hasTintedChip && <Text key="d" style={{ color: colors.wash }}>Dirty</Text>,
              ]
                .filter(Boolean)
                .flatMap((el, i) => (i === 0 ? [el] : [' \u00b7 ', el]))}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    marginBottom: 8,
  },
  pieceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  pieceName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13.5,
    color: colors.ink,
  },
  pieceSub: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 2,
  },
  pieceRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pieceQty: {
    fontFamily: fonts.mono,
    fontSize: 13.5,
    color: colors.ink,
    textAlign: 'right',
  },
  statusTags: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'flex-end',
    marginTop: 3,
  },
  flagBtnRepair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: colors.rust,
    backgroundColor: colors.rustTint,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  flagBtnTextRepair: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.rust,
  },
  flagBtnDirty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: colors.wash,
    backgroundColor: colors.washTint,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  flagBtnTextDirty: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.wash,
  },
  breakdown: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    padding: 14,
    paddingTop: 12,
  },
  colorGroup: {
    marginBottom: 14,
  },
  colorHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 7,
  },
  colorName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: colors.ink,
  },
  colorMeta: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: colors.inkSoft,
  },
  chipStrip: {
    marginHorizontal: -14,
    paddingHorizontal: 14,
  },
  sizeChip: {
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginRight: 6,
  },
  sizeChipText: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: colors.inkSoft,
  },
  chipAssigned: { borderColor: colors.ink, backgroundColor: '#FFFFFF' },
  chipUnassigned: { borderColor: colors.inkFaint, borderStyle: 'dashed', backgroundColor: 'transparent' },
  chipOut: { borderColor: colors.amber, backgroundColor: colors.amberTint },
  sizeChipRepair: { borderColor: colors.rust, backgroundColor: colors.rustTint },
  sizeChipDirty: { borderColor: colors.wash, backgroundColor: colors.washTint },
  sizeChipTextRepair: { color: colors.rust },
  sizeChipTextDirty: { color: colors.wash },
  legend: { fontFamily: fonts.body, fontSize: 10.5, color: colors.inkSoft },
  styleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  styleRowLast: {
    borderBottomWidth: 0,
  },
  styleName: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.ink,
  },
  styleQty: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.ink,
  },
});
