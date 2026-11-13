import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles, type Theme } from '../hooks/useTheme';
import { fonts } from '../constants/fonts';
import type { InventoryPiece, PieceType } from '../lib/models';
import { pieceCount, type Assignment } from '../lib/inventory';
import { cardSummary, lineStatuses } from '../lib/countedStock';
import { formatShortDate } from '../lib/format';
import { ChevronDownIcon, DropIcon, SmallChevronRightIcon, WrenchIcon } from './icons';
import OutlineButton from './OutlineButton';
import { bandNumbers } from '../lib/numberBands';
import { chipLabel } from '../lib/a11y';

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
  const { colors, expanded } = useTheme();
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
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityHint={isOpen ? 'Hides the details' : 'Shows every color and number'}
        // The Repair / Dirty buttons sit inside this row, which screen readers read as one
        // item, so they are offered as actions on the row instead.
        accessibilityActions={[
          ...(repairCount > 0 ? [{ name: 'repair', label: `Show ${repairCount} needing repair` }] : []),
          ...(dirtyCount > 0 ? [{ name: 'dirty', label: `Show ${dirtyCount} dirty` }] : []),
        ]}
        onAccessibilityAction={(event) => {
          const name = event.nativeEvent.actionName;
          if (name === 'repair' || name === 'dirty') onFlagPress(piece, name);
        }}
        style={styles.pieceRow}
        onPress={() => setIsOpen((prev) => !prev)}
      >
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
                  <Pressable accessibilityRole="button"
                    style={styles.flagBtnRepair}
                    onPress={() => onFlagPress(piece, 'repair')}
                  >
                    <WrenchIcon color={colors.rust} size={12} />
                    <Text style={styles.flagBtnTextRepair}>Repair · {repairCount}</Text>
                    <SmallChevronRightIcon color={colors.rust} />
                  </Pressable>
                )}
                {dirtyCount > 0 && (
                  <Pressable accessibilityRole="button" style={styles.flagBtnDirty} onPress={() => onFlagPress(piece, 'dirty')}>
                    <DropIcon color={colors.wash} size={12} />
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
                  {(expanded
                    ? bandNumbers(group.shown.map((s) => s.number))
                    : [{ label: '', numbers: group.shown.map((s) => s.number) }]
                  ).map((band) => (
                    <View key={band.label || 'all'}>
                      {band.label !== '' && <Text style={styles.bandLabel}>{band.label}</Text>}
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.chipStrip}
                      >
                        {band.numbers.map((size) => {
                          const assign = group.shown.find((s) => s.number === size)!.state;
                          const state = chipStateFor(group.color, size);
                          return (
                            <Pressable accessibilityRole="button"
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
                              accessibilityLabel={chipLabel(group.color, size, assign, state)}
                          accessibilityHint="Opens this number's history"
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
                              {state === 'repair' && <WrenchIcon color={colors.rust} size={10} />}
                              {state === 'dirty' && <DropIcon color={colors.wash} size={10} />}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  ))}
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
                <OutlineButton
                  label="Recount"
                  onSurface
                  onPress={onRecount}
                  accessibilityLabel={`Recount ${piece.name}`}
                />
              )}
            </View>
          )}
          {piece.kind === 'numbered' && onSeeAll && (
            <OutlineButton label={`See every ${piece.name} ›`} onSurface onPress={onSeeAll} accessibilityLabel={`See every ${piece.name}`} />
          )}
          {piece.kind === 'numbered' && (onAddColor || onAddNumber) && (
            <View style={styles.addLinks}>
              {onAddColor && (
                <OutlineButton label="+ Add color" onSurface onPress={onAddColor} accessibilityLabel={`Add color to ${piece.name}`} />
              )}
              {onAddNumber && (
                <OutlineButton label="+ Add number" onSurface onPress={onAddNumber} accessibilityLabel={`Add number to ${piece.name}`} />
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
    flexDirection: t.isLarge ? 'column' : 'row',
    alignItems: t.isLarge ? 'flex-start' : 'center',
    gap: 8,
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
    // Expanded: each color is its own box with room to breathe.
    ...(t.expanded
      ? { borderWidth: 1, borderColor: t.colors.lineSoft, backgroundColor: t.colors.white, borderRadius: 10, paddingVertical: 12 }
      : {}),
  },
  colorHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: t.expanded ? 12 : 0,
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
  chipStrip: t.expanded ? { paddingHorizontal: 12, marginBottom: 8 } : { marginHorizontal: -14, paddingHorizontal: 14 },
  bandLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: t.font(11),
    letterSpacing: 0.4,
    color: t.colors.inkSoft,
    paddingHorizontal: 12,
    marginTop: 4,
    marginBottom: 5,
  },
  sizeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: t.colors.line,
    paddingVertical: t.expanded ? 8 : 5,
    paddingHorizontal: t.expanded ? 10 : 8,
    marginRight: t.expanded ? 8 : 6,
  },
  sizeChipText: {
    fontFamily: fonts.mono,
    fontSize: t.font(t.expanded ? 13 : 10.5),
    color: t.colors.inkSoft,
  },
  chipAssigned: { borderColor: t.colors.ink, backgroundColor: '#FFFFFF' },
  chipUnassigned: { borderColor: t.colors.inkFaint, borderStyle: 'dashed', backgroundColor: 'transparent' },
  chipOut: { borderColor: t.colors.amber, backgroundColor: t.colors.amberTint },
  sizeChipRepair: { borderColor: t.colors.rust, backgroundColor: t.colors.rustTint },
  sizeChipDirty: { borderColor: t.colors.wash, backgroundColor: t.colors.washTint },
  sizeChipTextRepair: { color: t.colors.rust },
  sizeChipTextDirty: { color: t.colors.wash },
  addLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
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
});
}
