import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles, type Theme } from '../hooks/useTheme';
import { fonts } from '../constants/fonts';
import type { InventoryPiece, PieceType } from '../lib/models';
import { pieceCount, type Assignment } from '../lib/inventory';
import { cardSummary, lineStatuses } from '../lib/countedStock';
import { formatShortDate } from '../lib/format';
import { ChevronDownIcon, SmallChevronRightIcon } from './icons';

const byNumber = (a: string, b: string) => parseInt(a, 10) - parseInt(b, 10);

export default function PieceCard({
  piece,
  pieces,
  repairCount,
  dirtyCount,
  onFlagPress,
  onSizePress,
  onSeeAll,
  onAddColor,
  onAddNumber,
  chipStateFor,
  assignmentFor,
  matches,
  kept,
  unanswered = 0,
  onRecount,
}: {
  piece: PieceType;
  // This type's pieces.
  pieces: InventoryPiece[];
  repairCount: number;
  dirtyCount: number;
  onFlagPress: (piece: PieceType, kind: 'repair' | 'dirty') => void;
  onSizePress: (color: string, size: string) => void;
  onSeeAll?: () => void;
  onAddColor?: () => void;
  onAddNumber?: () => void;
  chipStateFor: (color: string, size: string) => 'repair' | 'dirty' | null;
  assignmentFor: (piece: InventoryPiece) => Assignment;
  // Whether a piece passes the screen's active filters (only matching chips render).
  matches: (piece: InventoryPiece) => boolean;
  // Counted types: shirts members keep at home per line label (White shirt only).
  kept?: Record<string, number>;
  unanswered?: number;
  onRecount?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
  const statuses = lineStatuses(piece.lines, kept);
  const summary = cardSummary(statuses);
  const hasTintedChip =
    piece.kind === 'numbered' &&
    groups.some((g) => g.shown.some((x) => chipStateFor(g.color, x.number) !== null));

  return (
    <View style={styles.piece}>
      <Pressable style={styles.pieceRow} onPress={() => setIsOpen((prev) => !prev)}>
        <View>
          <Text style={styles.pieceName}>{piece.name}</Text>
          <Text style={styles.pieceSub}>
            {piece.kind === 'numbered' ? piece.colors.join(', ') : piece.lines.map((l) => l.label).join(', ')}
          </Text>
        </View>
        <View style={styles.pieceRight}>
          <View>
            <Text style={styles.pieceQty}>
              {piece.kind === 'numbered'
                ? `${assignedTotal} / ${pieceCount(piece, pieces)} assigned`
                : `${summary.count} / ${summary.expected}`}
            </Text>
            {piece.kind === 'counted' && piece.lines.length > 0 && (
              <View style={styles.statusTags}>
                {summary.missing > 0 ? (
                  <Text style={[styles.countTag, styles.countTagMissing]}>{summary.missing} missing</Text>
                ) : (
                  <Text style={[styles.countTag, styles.countTagOk]}>all in</Text>
                )}
              </View>
            )}
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
              : statuses.map((line, index) => (
                  <View
                    key={line.label}
                    style={[styles.styleRow, index === statuses.length - 1 && styles.styleRowLast]}
                  >
                    <View>
                      <Text style={styles.styleName}>{line.label}</Text>
                      {line.kept > 0 && <Text style={styles.keptNote}>{line.kept} kept at home</Text>}
                    </View>
                    <Text style={[styles.styleQty, line.missing > 0 && styles.styleQtyMissing]}>
                      {line.count} / {line.expected}
                      {line.missing > 0 ? ` · ${line.missing} missing` : ''}
                    </Text>
                  </View>
                ));
          })()}
          {piece.kind === 'counted' && (
            <View style={styles.countFooter}>
              {unanswered > 0 && (
                <Text style={styles.countMeta}>
                  {unanswered === 1 ? "1 member hasn't answered" : `${unanswered} members haven't answered`}
                </Text>
              )}
              <Text style={styles.countMeta}>
                {piece.countedAt ? `Last counted ${formatShortDate(piece.countedAt)}` : 'Not counted yet'}
              </Text>
              {onRecount && (
                <Pressable
                  style={styles.recountBtn}
                  onPress={onRecount}
                  accessibilityRole="button"
                  accessibilityLabel={`Recount ${piece.name}`}
                >
                  <Text style={styles.recountText}>Recount</Text>
                </Pressable>
              )}
            </View>
          )}
          {piece.kind === 'numbered' && onSeeAll && (
            <Pressable onPress={onSeeAll} accessibilityLabel={`See every ${piece.name}`}>
              <Text style={styles.seeAll}>See every {piece.name} {'›'}</Text>
            </Pressable>
          )}
          {piece.kind === 'numbered' && (onAddColor || onAddNumber) && (
            <View style={styles.addLinks}>
              {onAddColor && (
                <Pressable onPress={onAddColor} accessibilityLabel={`Add color to ${piece.name}`}>
                  <Text style={styles.seeAll}>Add color</Text>
                </Pressable>
              )}
              {onAddNumber && (
                <Pressable onPress={onAddNumber} accessibilityLabel={`Add number to ${piece.name}`}>
                  <Text style={styles.seeAll}>Add number</Text>
                </Pressable>
              )}
            </View>
          )}
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

function makeStyles(t: Theme) {
  return StyleSheet.create({
  piece: {
    borderWidth: 1,
    borderColor: t.colors.line,
    backgroundColor: t.colors.surface,
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
    fontSize: t.font(13.5),
    color: t.colors.ink,
  },
  pieceSub: {
    fontFamily: fonts.body,
    fontSize: t.font(11),
    color: t.colors.inkSoft,
    marginTop: 2,
  },
  pieceRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pieceQty: {
    fontFamily: fonts.mono,
    fontSize: t.font(13.5),
    color: t.colors.ink,
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
    borderColor: t.colors.rust,
    backgroundColor: t.colors.rustTint,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  flagBtnTextRepair: {
    fontFamily: fonts.body,
    fontSize: t.font(10.5),
    color: t.colors.rust,
  },
  flagBtnDirty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: t.colors.wash,
    backgroundColor: t.colors.washTint,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  flagBtnTextDirty: {
    fontFamily: fonts.body,
    fontSize: t.font(10.5),
    color: t.colors.wash,
  },
  breakdown: {
    borderTopWidth: 1,
    borderTopColor: t.colors.line,
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
    fontSize: t.font(12.5),
    color: t.colors.ink,
  },
  colorMeta: {
    fontFamily: fonts.body,
    fontSize: t.font(10.5),
    color: t.colors.inkSoft,
  },
  chipStrip: {
    marginHorizontal: -14,
    paddingHorizontal: 14,
  },
  sizeChip: {
    borderWidth: 1,
    borderColor: t.colors.line,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginRight: 6,
  },
  sizeChipText: {
    fontFamily: fonts.mono,
    fontSize: t.font(10.5),
    color: t.colors.inkSoft,
  },
  chipAssigned: { borderColor: t.colors.ink, backgroundColor: '#FFFFFF' },
  chipUnassigned: { borderColor: t.colors.inkFaint, borderStyle: 'dashed', backgroundColor: 'transparent' },
  chipOut: { borderColor: t.colors.amber, backgroundColor: t.colors.amberTint },
  sizeChipRepair: { borderColor: t.colors.rust, backgroundColor: t.colors.rustTint },
  sizeChipDirty: { borderColor: t.colors.wash, backgroundColor: t.colors.washTint },
  sizeChipTextRepair: { color: t.colors.rust },
  sizeChipTextDirty: { color: t.colors.wash },
  seeAll: {
    fontFamily: fonts.bodyMedium,
    fontSize: t.font(12),
    color: t.colors.ink,
    textDecorationLine: 'underline',
    marginBottom: 8,
  },
  addLinks: { flexDirection: 'row', gap: 18 },
  legend: { fontFamily: fonts.body, fontSize: t.font(10.5), color: t.colors.inkSoft },
  styleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.lineSoft,
  },
  styleRowLast: {
    borderBottomWidth: 0,
  },
  styleName: {
    fontFamily: fonts.body,
    fontSize: t.font(12.5),
    color: t.colors.ink,
  },
  styleQty: {
    fontFamily: fonts.mono,
    fontSize: t.font(12),
    color: t.colors.ink,
  },
  styleQtyMissing: { color: t.colors.amber },
  keptNote: { fontFamily: fonts.body, fontSize: t.font(10.5), color: t.colors.inkSoft, marginTop: 1 },
  countTag: {
    fontFamily: fonts.body,
    fontSize: t.font(10.5),
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 7,
    overflow: 'hidden',
  },
  countTagMissing: { color: t.colors.amber, borderColor: t.colors.amber, backgroundColor: t.colors.amberTint },
  countTagOk: { color: t.colors.wash, borderColor: t.colors.wash, backgroundColor: t.colors.washTint },
  countFooter: { marginTop: 10, gap: 4 },
  countMeta: { fontFamily: fonts.body, fontSize: t.font(11), color: t.colors.inkSoft },
  recountBtn: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: t.colors.ink,
    paddingVertical: 8,
    alignItems: 'center',
  },
  recountText: { fontFamily: fonts.bodyMedium, fontSize: t.font(12.5), color: t.colors.ink },
});
}
