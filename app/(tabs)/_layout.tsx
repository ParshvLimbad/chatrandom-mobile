import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuthStore } from "@/stores/auth-store";

export default function TabsLayout(): JSX.Element {
  const router = useRouter();
  const isPremium = useAuthStore((state) => state.isPremium());

  const renderUpgradeButton = (): JSX.Element | null => {
    if (isPremium) {
      return null;
    }

    return (
      <Pressable
        onPress={() =>
          router.push({
            params: { focus: "paywall" },
            pathname: "/settings",
          })
        }
        style={styles.upgradeButton}
      >
        <Text style={styles.upgradeText}>Upgrade</Text>
      </Pressable>
    );
  };

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#07111f" },
        headerTintColor: "#f4f7fb",
        headerTitleStyle: { fontWeight: "800" },
        headerShadowVisible: false,
        headerRight: renderUpgradeButton,
        sceneStyle: { backgroundColor: "#07111f" },
        tabBarActiveTintColor: "#5be6c5",
        tabBarInactiveTintColor: "#8291a6",
        tabBarStyle: {
          backgroundColor: "#0b1324",
          borderTopColor: "#172033",
          height: 76,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="video"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="videocam" size={size} />
          ),
          title: "Video",
        }}
      />
      <Tabs.Screen
        name="voice"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="mic" size={size} />
          ),
          title: "Voice",
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="chatbubble-ellipses" size={size} />
          ),
          title: "Chat",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          headerRight: () => <View />,
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="settings" size={size} />
          ),
          title: "Settings",
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  upgradeButton: {
    backgroundColor: "rgba(91, 230, 197, 0.18)",
    borderColor: "rgba(91, 230, 197, 0.38)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  upgradeText: {
    color: "#5be6c5",
    fontSize: 13,
    fontWeight: "800",
  },
});
