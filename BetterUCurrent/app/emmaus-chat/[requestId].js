import { useLocalSearchParams } from "expo-router";
import { EmmausCompanionChat } from "../../components/emmaus/EmmausCompanionChat";

export default function EmmausChatRoute() {
  const { requestId } = useLocalSearchParams();
  const id = Array.isArray(requestId) ? requestId[0] : requestId;
  return <EmmausCompanionChat requestId={id} />;
}
