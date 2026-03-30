import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  View,
} from "react-native";

interface AudioWaveProps {
  active: boolean;
}

export function AudioWave({ active }: AudioWaveProps): JSX.Element {
  const bars = useRef(
    Array.from({ length: 6 }, () => new Animated.Value(0.3)),
  ).current;

  useEffect(() => {
    if (!active) {
      bars.forEach((bar) => bar.setValue(0.3));
      return;
    }

    const loops = bars.map((bar, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, {
            duration: 380 + index * 60,
            easing: Easing.inOut(Easing.ease),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            duration: 380 + index * 70,
            easing: Easing.inOut(Easing.ease),
            toValue: 0.25,
            useNativeDriver: true,
          }),
        ]),
      ),
    );

    loops.forEach((loop) => loop.start());
    return () => {
      loops.forEach((loop) => loop.stop());
    };
  }, [active, bars]);

  return (
    <View style={styles.row}>
      {bars.map((bar, index) => (
        <Animated.View
          key={`${index}`}
          style={[
            styles.bar,
            {
              transform: [
                {
                  scaleY: bar,
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: "#5be6c5",
    borderRadius: 999,
    height: 84,
    width: 12,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
});
