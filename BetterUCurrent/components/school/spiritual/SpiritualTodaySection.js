import React from "react";
import { View, StyleSheet } from "react-native";
import { DailyExamenCta } from "./DailyExamenCta";
import { DailyReadingsCard } from "./DailyReadingsCard";
import { LiveTheFourthTodayTasks } from "./LiveTheFourthTodayTasks";
import { VolunteerPromoCard } from "../VolunteerPromoCard";
import { ServiceHourSubmitCard } from "./ServiceHourSubmitCard";

/**
 * Student "Today" stack: prayer, scripture, weekly formation tasks, service.
 */
export function SpiritualTodaySection({ prompts, promptsLoading, orgId, orgReady }) {
  return (
    <>
      <View style={styles.heroRow}>
        <DailyExamenCta compact />
        <DailyReadingsCard compact />
      </View>
      <LiveTheFourthTodayTasks prompts={prompts} loading={promptsLoading} />
      <VolunteerPromoCard compact />
      <ServiceHourSubmitCard orgId={orgId} orgReady={orgReady} />
    </>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch",
  },
});
