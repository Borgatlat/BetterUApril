import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  FREE_VS_PREMIUM_ROWS,
  PREMIUM_BENEFIT_CATEGORIES,
  PREMIUM_VALUE_ANCHOR,
  PREMIUM_VALUE_COMPARISONS,
} from '../../lib/premiumBenefits';

/**
 * Renders the full Premium value story: anchor, categories, comparison table.
 * Used on /purchase-subscription so marketing stays in sync with lib/premiumBenefits.js.
 */
export default function PremiumBenefitsShowcase({ showValueComparisons = true }) {
  return (
    <View>
      <View style={styles.valueAnchor}>
        <Text style={styles.valueHeadline}>{PREMIUM_VALUE_ANCHOR.headline}</Text>
        <Text style={styles.valueSubline}>{PREMIUM_VALUE_ANCHOR.subline}</Text>
        <View style={styles.trialPill}>
          <Ionicons name="gift-outline" size={14} color="#000" />
          <Text style={styles.trialPillText}>{PREMIUM_VALUE_ANCHOR.trialLabel}</Text>
        </View>
      </View>

      {showValueComparisons && (
        <View style={styles.comparisonStack}>
          {PREMIUM_VALUE_COMPARISONS.map((row) => (
            <View
              key={row.label}
              style={[styles.comparisonRow, row.highlight && styles.comparisonRowHighlight]}
            >
              <Text style={[styles.comparisonLabel, row.highlight && styles.comparisonLabelHighlight]}>
                {row.label}
              </Text>
              <Text style={[styles.comparisonCost, row.highlight && styles.comparisonCostHighlight]}>
                {row.cost}
              </Text>
            </View>
          ))}
        </View>
      )}

      {PREMIUM_BENEFIT_CATEGORIES.map((category) => (
        <View key={category.id} style={styles.categoryBlock}>
          <View style={styles.categoryHeader}>
            <View style={[styles.categoryIconWrap, { backgroundColor: `${category.color}22` }]}>
              <Ionicons name={category.icon} size={18} color={category.color} />
            </View>
            <View style={styles.categoryTitles}>
              <Text style={[styles.categoryTitle, { color: category.color }]}>{category.title}</Text>
              <Text style={styles.categorySubtitle}>{category.subtitle}</Text>
            </View>
          </View>

          {category.items.map((item) => (
            <View key={item.title} style={styles.benefitRow}>
              <View style={styles.benefitIcon}>
                <Ionicons name={item.icon} size={18} color={category.color} />
              </View>
              <View style={styles.benefitBody}>
                <View style={styles.benefitTitleRow}>
                  <Text style={styles.benefitTitle}>{item.title}</Text>
                  {item.badge ? (
                    <View style={[styles.badge, { borderColor: category.color }]}>
                      <Text style={[styles.badgeText, { color: category.color }]}>{item.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.benefitDescription}>{item.description}</Text>
                {item.freeLimit && item.premiumLimit ? (
                  <Text style={styles.benefitLimits}>
                    Free: {item.freeLimit}  →  Premium: {item.premiumLimit}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ))}

      <View style={styles.compareContainer}>
        <Text style={styles.compareTitle}>Free vs Premium at a glance</Text>
        <View style={styles.compareHeaderRow}>
          <Text style={[styles.compareCell, styles.compareFeatureCol]}> </Text>
          <Text style={styles.compareCell}>Free</Text>
          <Text style={[styles.compareCell, styles.comparePremiumCol]}>Premium</Text>
        </View>
        {FREE_VS_PREMIUM_ROWS.map((row) => (
          <View key={row.feature} style={styles.compareRow}>
            <Text style={[styles.compareCell, styles.compareFeatureCol]}>{row.feature}</Text>
            <Text style={styles.compareCell}>{row.free}</Text>
            <Text style={[styles.compareCell, styles.comparePremiumCol]}>{row.premium}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  valueAnchor: {
    marginBottom: 20,
    padding: 18,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  valueHeadline: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 8,
  },
  valueSubline: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 20,
  },
  trialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#00ffff',
  },
  trialPillText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },
  comparisonStack: {
    marginBottom: 22,
    gap: 8,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  comparisonRowHighlight: {
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.35)',
  },
  comparisonLabel: {
    color: '#aaa',
    fontSize: 13,
    flex: 1,
  },
  comparisonLabelHighlight: {
    color: '#FFD700',
    fontWeight: '700',
  },
  comparisonCost: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  comparisonCostHighlight: {
    color: '#00ffff',
    fontWeight: '800',
  },
  categoryBlock: {
    marginBottom: 22,
    backgroundColor: 'rgba(0, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.08)',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  categoryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitles: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
  },
  categorySubtitle: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
  },
  benefitRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  benefitIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  benefitBody: {
    flex: 1,
  },
  benefitTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    flexShrink: 1,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  benefitDescription: {
    fontSize: 13,
    color: '#bbb',
    lineHeight: 18,
  },
  benefitLimits: {
    marginTop: 4,
    fontSize: 11,
    color: '#00ffff',
    fontWeight: '600',
  },
  compareContainer: {
    marginBottom: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  compareTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 12,
  },
  compareHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
    paddingBottom: 8,
    marginBottom: 4,
  },
  compareRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  compareCell: {
    flex: 1,
    fontSize: 12,
    color: '#ccc',
    textAlign: 'center',
  },
  compareFeatureCol: {
    flex: 1.6,
    textAlign: 'left',
    color: '#fff',
    fontSize: 11,
  },
  comparePremiumCol: {
    color: '#00ffff',
    fontWeight: '600',
  },
});
