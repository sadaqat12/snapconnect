// CSS Interop Hack for NativeWind
import { cssInterop } from 'react-native-css-interop';
import { View, Text, TextInput, Pressable, ScrollView, Image } from 'react-native';

// Register core components with NativeWind
cssInterop(View, { className: 'style' });
cssInterop(Text, { className: 'style' });
cssInterop(TextInput, { className: 'style' });
cssInterop(Pressable, { className: 'style' });
cssInterop(ScrollView, { className: 'style', contentContainerClass: 'contentContainerStyle' });
cssInterop(Image, { className: 'style' }); 