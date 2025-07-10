// Test fixtures for the Rust parser

export const SIMPLE_FUNCTION = `
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}
`

export const GENERIC_FUNCTION = `
fn swap<T>(x: &mut T, y: &mut T) {
    std::mem::swap(x, y);
}
`

export const ASYNC_FUNCTION = `
async fn fetch_data(url: &str) -> Result<String, reqwest::Error> {
    let response = reqwest::get(url).await?;
    response.text().await
}
`

export const SIMPLE_STRUCT = `
struct Point {
    x: f64,
    y: f64,
}
`

export const GENERIC_STRUCT = `
#[derive(Debug, Clone)]
pub struct Vec3<T> {
    pub x: T,
    pub y: T,
    pub z: T,
}
`

export const TUPLE_STRUCT = `
pub struct Color(u8, u8, u8);
`

export const UNIT_STRUCT = `
struct Unit;
`

export const SIMPLE_ENUM = `
enum Direction {
    North,
    South,
    East,
    West,
}
`

export const COMPLEX_ENUM = `
#[derive(Debug, PartialEq)]
pub enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(String),
    ChangeColor(i32, i32, i32),
}
`

export const GENERIC_ENUM = `
enum Option<T> {
    Some(T),
    None,
}
`

export const TRAIT_DEFINITION = `
pub trait Draw {
    fn draw(&self);
    
    fn area(&self) -> f64 {
        0.0
    }
}
`

export const TRAIT_WITH_GENERICS = `
pub trait Iterator<T> {
    type Item;
    
    fn next(&mut self) -> Option<Self::Item>;
    
    fn collect<B>(self) -> B 
    where 
        B: FromIterator<Self::Item>,
        Self: Sized;
}
`

export const IMPL_BLOCK = `
impl Point {
    fn new(x: f64, y: f64) -> Self {
        Point { x, y }
    }
    
    fn distance_from_origin(&self) -> f64 {
        (self.x.powi(2) + self.y.powi(2)).sqrt()
    }
}
`

export const TRAIT_IMPL = `
impl Draw for Point {
    fn draw(&self) {
        println!("Drawing point at ({}, {})", self.x, self.y);
    }
    
    fn area(&self) -> f64 {
        0.0
    }
}
`

export const GENERIC_IMPL = `
impl<T> Vec3<T> 
where
    T: Copy + Add<Output = T> + Mul<Output = T>,
{
    pub fn new(x: T, y: T, z: T) -> Self {
        Vec3 { x, y, z }
    }
    
    pub fn dot(&self, other: &Vec3<T>) -> T {
        self.x * other.x + self.y * other.y + self.z * other.z
    }
}
`

export const MODULE_DEFINITION = `
pub mod geometry {
    pub struct Point {
        pub x: f64,
        pub y: f64,
    }
    
    pub mod shapes {
        use super::Point;
        
        pub struct Circle {
            center: Point,
            radius: f64,
        }
    }
}
`

export const USE_STATEMENTS = `
use std::collections::HashMap;
use std::io::{self, Write};
use serde::{Deserialize, Serialize};
use crate::geometry::Point;
`

export const CONSTANTS_AND_STATICS = `
const MAX_POINTS: usize = 100;
static mut COUNTER: usize = 0;

pub const PI: f64 = 3.14159265359;
pub static VERSION: &str = "1.0.0";
`

export const TYPE_ALIASES = `
type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;
type Point2D = Point<f64>;
type Callback = Box<dyn Fn(i32) -> i32>;
`

export const MACRO_DEFINITION = `
macro_rules! vec {
    ( $( $x:expr ),* ) => {
        {
            let mut temp_vec = Vec::new();
            $(
                temp_vec.push($x);
            )*
            temp_vec
        }
    };
}
`

export const ATTRIBUTES_AND_DERIVES = `
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    #[serde(rename = "userId")]
    pub id: u32,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
}
`

export const COMPLEX_GENERICS = `
struct Container<T, U> 
where
    T: Clone + Debug,
    U: Send + Sync,
{
    items: Vec<T>,
    metadata: U,
}

impl<T, U> Container<T, U> 
where
    T: Clone + Debug,
    U: Send + Sync,
{
    fn new(metadata: U) -> Self {
        Container {
            items: Vec::new(),
            metadata,
        }
    }
    
    fn add_item(&mut self, item: T) {
        self.items.push(item);
    }
}
`

export const LIFETIMES = `
struct ImportantExcerpt<'a> {
    part: &'a str,
}

impl<'a> ImportantExcerpt<'a> {
    fn level(&self) -> i32 {
        3
    }
    
    fn announce_and_return_part(&self, announcement: &str) -> &str {
        println!("Attention please: {}", announcement);
        self.part
    }
}

fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() {
        x
    } else {
        y
    }
}
`

export const ASSOCIATED_TYPES = `
trait Iterator {
    type Item;
    
    fn next(&mut self) -> Option<Self::Item>;
}

struct Counter {
    current: usize,
    max: usize,
}

impl Iterator for Counter {
    type Item = usize;
    
    fn next(&mut self) -> Option<Self::Item> {
        if self.current < self.max {
            let current = self.current;
            self.current += 1;
            Some(current)
        } else {
            None
        }
    }
}
`

export const COMPLETE_MODULE = `
//! This module provides geometry utilities
#![allow(dead_code)]

use std::f64::consts::PI;
use std::fmt::{self, Display};

/// A 2D point in space
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

/// Different types of shapes
#[derive(Debug, PartialEq)]
pub enum Shape {
    Circle { center: Point, radius: f64 },
    Rectangle { top_left: Point, bottom_right: Point },
    Triangle([Point; 3]),
}

/// Trait for drawable objects
pub trait Drawable {
    fn draw(&self);
    fn area(&self) -> f64;
}

impl Point {
    /// Create a new point
    pub fn new(x: f64, y: f64) -> Self {
        Point { x, y }
    }
    
    /// Calculate distance from origin
    pub fn distance_from_origin(&self) -> f64 {
        (self.x.powi(2) + self.y.powi(2)).sqrt()
    }
    
    /// Calculate distance to another point
    pub fn distance_to(&self, other: &Point) -> f64 {
        ((self.x - other.x).powi(2) + (self.y - other.y).powi(2)).sqrt()
    }
}

impl Display for Point {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "({}, {})", self.x, self.y)
    }
}

impl Shape {
    pub fn new_circle(center: Point, radius: f64) -> Self {
        Shape::Circle { center, radius }
    }
    
    pub fn new_rectangle(top_left: Point, bottom_right: Point) -> Self {
        Shape::Rectangle { top_left, bottom_right }
    }
}

impl Drawable for Shape {
    fn draw(&self) {
        match self {
            Shape::Circle { center, radius } => {
                println!("Drawing circle at {} with radius {}", center, radius);
            }
            Shape::Rectangle { top_left, bottom_right } => {
                println!("Drawing rectangle from {} to {}", top_left, bottom_right);
            }
            Shape::Triangle(points) => {
                println!("Drawing triangle with points: {:?}", points);
            }
        }
    }
    
    fn area(&self) -> f64 {
        match self {
            Shape::Circle { radius, .. } => PI * radius * radius,
            Shape::Rectangle { top_left, bottom_right } => {
                let width = (bottom_right.x - top_left.x).abs();
                let height = (top_left.y - bottom_right.y).abs();
                width * height
            }
            Shape::Triangle(points) => {
                // Using shoelace formula
                let [a, b, c] = points;
                0.5 * ((a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)).abs())
            }
        }
    }
}

/// Utility functions
pub mod utils {
    use super::Point;
    
    pub fn centroid(points: &[Point]) -> Point {
        let sum_x: f64 = points.iter().map(|p| p.x).sum();
        let sum_y: f64 = points.iter().map(|p| p.y).sum();
        let count = points.len() as f64;
        
        Point::new(sum_x / count, sum_y / count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_point_creation() {
        let p = Point::new(3.0, 4.0);
        assert_eq!(p.x, 3.0);
        assert_eq!(p.y, 4.0);
    }
    
    #[test]
    fn test_distance_from_origin() {
        let p = Point::new(3.0, 4.0);
        assert_eq!(p.distance_from_origin(), 5.0);
    }
}
`

export const SYNTAX_ERRORS = `
fn broken_function( {
    let x = 5
    println!("Missing closing brace and semicolon")
}

struct MissingFields {
    x: i32
    // Missing comma
    y: i32
}

impl MissingFor Point {
    fn invalid() {
        // Missing self parameter type
    }
}
`

export const LARGE_FILE = `
// This is a large file for performance testing
${Array.from(
  { length: 100 },
  (_, i) => `
struct Generated${i} {
    field_a: i32,
    field_b: String,
    field_c: Vec<u8>,
}

impl Generated${i} {
    fn new() -> Self {
        Generated${i} {
            field_a: ${i},
            field_b: String::from("generated_${i}"),
            field_c: vec![${i % 256}; 10],
        }
    }
    
    fn method_a(&self) -> i32 {
        self.field_a * 2
    }
    
    fn method_b(&mut self, value: i32) {
        self.field_a += value;
    }
}
`,
).join('\n')}
`

export const TEST_FIXTURES = {
  SIMPLE_FUNCTION,
  GENERIC_FUNCTION,
  ASYNC_FUNCTION,
  SIMPLE_STRUCT,
  GENERIC_STRUCT,
  TUPLE_STRUCT,
  UNIT_STRUCT,
  SIMPLE_ENUM,
  COMPLEX_ENUM,
  GENERIC_ENUM,
  TRAIT_DEFINITION,
  TRAIT_WITH_GENERICS,
  IMPL_BLOCK,
  TRAIT_IMPL,
  GENERIC_IMPL,
  MODULE_DEFINITION,
  USE_STATEMENTS,
  CONSTANTS_AND_STATICS,
  TYPE_ALIASES,
  MACRO_DEFINITION,
  ATTRIBUTES_AND_DERIVES,
  COMPLEX_GENERICS,
  LIFETIMES,
  ASSOCIATED_TYPES,
  COMPLETE_MODULE,
  SYNTAX_ERRORS,
  LARGE_FILE,
}

export type FixtureName = keyof typeof TEST_FIXTURES
