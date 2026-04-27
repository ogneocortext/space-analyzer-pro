import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SkeletonLoader, StaggeredList, PageTransition } from "./shared/ProgressiveLoading";

const FramerMotionDemo: React.FC = () => {
  const [showContent, setShowContent] = useState(false);
  const [items, setItems] = useState([
    { id: 1, text: "Item 1", color: "bg-blue-500" },
    { id: 2, text: "Item 2", color: "bg-green-500" },
    { id: 3, text: "Item 3", color: "bg-purple-500" },
    { id: 4, text: "Item 4", color: "bg-pink-500" },
  ]);

  const addItem = () => {
    const newItem = {
      id: Date.now(),
      text: `Item ${items.length + 1}`,
      color: ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-pink-500"][
        Math.floor(Math.random() * 4)
      ],
    };
    setItems((prev) => [...prev, newItem]);
  };

  const removeItem = (id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-white mb-4">Framer Motion Demo</h1>
        <p className="text-gray-300 mb-6">
          Experience the power of hardware-accelerated animations with Framer Motion 12!
        </p>
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="flex gap-4 mb-8"
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowContent(!showContent)}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          {showContent ? "Hide" : "Show"} Content
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={addItem}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
        >
          Add Item
        </motion.button>
      </motion.div>

      {/* Content with Page Transition */}
      <AnimatePresence mode="wait">
        {showContent && (
          <PageTransition isLoading={false}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Skeleton Loading Demo */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gray-800 rounded-lg p-6"
              >
                <h2 className="text-xl font-semibold text-white mb-4">Skeleton Loading</h2>
                <div className="space-y-3">
                  <SkeletonLoader width="100%" height={20} />
                  <SkeletonLoader width="80%" height={20} />
                  <SkeletonLoader width="60%" height={20} />
                </div>
              </motion.div>

              {/* Staggered List Demo */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-gray-800 rounded-lg p-6"
              >
                <h2 className="text-xl font-semibold text-white mb-4">Staggered List Animation</h2>
                <StaggeredList
                  items={items}
                  renderItem={(item, index) => (
                    <motion.div
                      className={`p-4 ${item.color} text-white rounded-lg flex justify-between items-center`}
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <span className="font-medium">{item.text}</span>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => removeItem(item.id)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
                      >
                        Remove
                      </motion.button>
                    </motion.div>
                  )}
                  loading={false}
                  staggerDelay={0.1}
                />
              </motion.div>

              {/* Hover Effects Demo */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-gray-800 rounded-lg p-6"
              >
                <h2 className="text-xl font-semibold text-white mb-4">Hover Effects</h2>
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <motion.div
                      key={i}
                      whileHover={{
                        scale: 1.05,
                        rotate: 5,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
                      }}
                      whileTap={{ scale: 0.95 }}
                      className="bg-gradient-to-br from-blue-500 to-purple-600 p-6 rounded-lg text-white text-center cursor-pointer"
                    >
                      <motion.div
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.6 }}
                        className="text-2xl mb-2"
                      >
                        🎯
                      </motion.div>
                      <div className="font-semibold">Card {i}</div>
                      <div className="text-sm opacity-80">Hover me!</div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Gesture Demo */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 }}
                className="bg-gray-800 rounded-lg p-6"
              >
                <h2 className="text-xl font-semibold text-white mb-4">Gesture Recognition</h2>
                <motion.div
                  drag
                  dragConstraints={{ left: -100, right: 100, top: -50, bottom: 50 }}
                  whileDrag={{ scale: 1.1, rotate: 10 }}
                  className="w-32 h-32 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white font-bold cursor-grab active:cursor-grabbing mx-auto"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    🎪
                  </motion.div>
                </motion.div>
                <p className="text-center text-gray-400 mt-4">Drag me around!</p>
              </motion.div>
            </motion.div>
          </PageTransition>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FramerMotionDemo;
