import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import type { Piece } from '../constants/inventoryData';
import { ChevronDownIcon, SmallChevronRightIcon } from './icons';

export default function PieceCard({
  piece,
  onFlagPress,
}: {
  piece: Piece;
  onFlagPress: (piece: Piece, kind: 'repair' | 'dirty') => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.piece}>
      <Pressable style={styles.pieceRow} onPress={() => setIsOpen((prev) => !prev)}>
        <View>
          <Text style={styles.pieceName}>{piece.name}</Text>
          <Text style={styles.pieceSub}>{piece.colorsLabel}</Text>
        </View>
        <View style={styles.pieceRight}>
          <View>
            <Text style={styles.pieceQty}>{piece.qty}</Text>
            {(piece.repairCount > 0 || piece.dirtyCount > 0) && (
              <View style={styles.statusTags}>
                {piece.repairCount > 0 && (
                  <Pressable
                    style={styles.flagBtnRepair}
                    onPress={() => onFlagPress(piece, 'repair')}
                  >
                    <Text style={styles.flagBtnTextRepair}>Repair · {piece.repairCount}</Text>
                    <SmallChevronRightIcon color={colors.rust} />
                  </Pressable>
                )}
                {piece.dirtyCount > 0 && (
                  <Pressable style={styles.flagBtnDirty} onPress={() => onFlagPress(piece, 'dirty')}>
                    <Text style={styles.flagBtnTextDirty}>Dirty · {piece.dirtyCount}</Text>
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
            const breakdown = piece.breakdown;
            return breakdown.type === 'graded'
              ? breakdown.groups.map((group) => (
                <View key={group.color} style={styles.colorGroup}>
                  <View style={styles.colorHead}>
                    <Text style={styles.colorName}>{group.color}</Text>
                    <Text style={styles.colorMeta}>
                      {group.sizes.length} in stock · {group.sizes[0]}–
                      {group.sizes[group.sizes.length - 1]}
                    </Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipStrip}
                  >
                    {group.sizes.map((size) => (
                      <View key={size} style={styles.sizeChip}>
                        <Text style={styles.sizeChipText}>{size}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ))
              : breakdown.rows.map((row, index) => (
                  <View
                    key={row.name}
                    style={[
                      styles.styleRow,
                      index === breakdown.rows.length - 1 && styles.styleRowLast,
                    ]}
                  >
                    <Text style={styles.styleName}>{row.name}</Text>
                    <Text style={styles.styleQty}>{row.qty}</Text>
                  </View>
                ));
          })()}
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
