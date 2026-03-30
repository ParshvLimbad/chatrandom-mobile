import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function NotFoundScreen(): JSX.Element {
  return (
    <>
      <Stack.Screen options={{ title: "Not found", headerShown: true }} />
      <View style={styles.container}>
        <Text style={styles.title}>This route does not exist.</Text>
        <Link href="/" style={styles.link}>
          Back to Speaky
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#07111f",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  link: {
    color: "#5be6c5",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 16,
  },
  title: {
    color: "#f4f7fb",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
});
