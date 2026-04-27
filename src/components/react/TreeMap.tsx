import React, { useRef, useEffect } from "react";
// @ts-ignore
import * as d3 from "d3";

interface TreeNode {
  name: string;
  size?: number;
  children?: TreeNode[];
  category?: string;
  path?: string;
}

interface TreemapProps {
  data: TreeNode;
  width: number;
  height: number;
  onNodeClick?: (node: TreeNode) => void;
}

const Treemap: React.FC<TreemapProps> = ({ data, width, height, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Create hierarchy
    const root = d3
      .hierarchy(data)
      .sum((d) => d.size || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Create treemap layout with squarified algorithm
    const treemap = d3
      .treemap()
      .tile(d3.treemapSquarify)
      .size([width, height])
      .padding(1)
      .round(true);

    treemap(root);

    // Color scale based on category
    const color = d3
      .scaleOrdinal()
      .domain(["Documents", "Images", "Code", "Other"])
      .range(["#3b82f6", "#10b981", "#f59e0b", "#6b7280"]);

    // Create nodes
    const nodes = svg
      .selectAll("g")
      .data(root.leaves())
      .enter()
      .append("g")
      .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

    // Add rectangles
    nodes
      .append("rect")
      .attr("width", (d) => Math.max(0, d.x1 - d.x0))
      .attr("height", (d) => Math.max(0, d.y1 - d.y0))
      .attr("fill", (d) => color(d.data.category || "Other") as string)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("click", (event, d) => onNodeClick?.(d.data))
      .on("mouseover", function (event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr(
            "fill",
            d3
              .color(color(d.data.category || "Other") as string)
              ?.darker(0.5)
              ?.toString() || "#000"
          );

        // Add tooltip
        const tooltip = d3
          .select("body")
          .append("div")
          .attr("class", "treemap-tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0, 0, 0, 0.8)")
          .style("color", "#fff")
          .style("padding", "8px")
          .style("border-radius", "4px")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .style("z-index", "1000")
          .html(
            `<strong>${d.data.name}</strong><br>Size: ${(d.value || 0).toLocaleString()} bytes<br>Category: ${d.data.category || "Other"}`
          );

        tooltip.style("left", event.pageX + 10 + "px").style("top", event.pageY - 10 + "px");
      })
      .on("mouseout", function (event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("fill", color(d.data.category || "Other") as string);

        // Remove tooltip
        d3.select(".treemap-tooltip").remove();
      });

    // Add text labels for larger rectangles
    nodes
      .filter((d) => d.x1 - d.x0 > 50 && d.y1 - d.y0 > 20)
      .append("text")
      .attr("x", 4)
      .attr("y", 14)
      .attr("font-size", "10px")
      .attr("fill", "#fff")
      .attr("font-weight", "500")
      .style("pointer-events", "none")
      .text((d) => (d.data.name.length > 15 ? d.data.name.substring(0, 15) + "..." : d.data.name));
  }, [data, width, height, onNodeClick]);

  return (
    <div style={{ position: "relative" }}>
      <svg ref={svgRef} width={width} height={height} />
      {/* @ts-ignore - jsx prop */}
      <style jsx>{`
        .treemap-tooltip {
          font-family: "Inter", sans-serif;
        }
      `}</style>
    </div>
  );
};

export default Treemap;
